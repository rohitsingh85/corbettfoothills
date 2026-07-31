import { chromium } from "playwright";

const BASE = "http://localhost:8788";

const MOCK_AVAILABILITY = {
  rooms: [
    {
      slug: "Family Room",
      room_type: "Family Room",
      name: "Family Room",
      available: true,
      roomsLeft: 2,
      nightlyRate: 3500,
      originalNightlyRate: 4000,
      totalStay: 7000,
      originalTotal: 8000,
      grandTotal: 7000,
      taxBreakdown: [{ label: "GST 12%", amount: 840 }],
      totalTaxes: 840,
      cancellationPolicy: "Free cancellation up to 48 hours before check-in",
    },
    {
      slug: "Deluxe Room",
      room_type: "Deluxe Room",
      name: "Deluxe Room",
      available: false,
      roomsLeft: 0,
      nightlyRate: 3200,
      originalNightlyRate: null,
      totalStay: 6400,
      originalTotal: null,
      grandTotal: 6400,
      taxBreakdown: [],
      totalTaxes: 0,
      cancellationPolicy: "",
    },
  ],
  checkin: "2026-08-01",
  checkout: "2026-08-03",
};

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${extra ? " — " + extra : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push("console: " + msg.text());
});

await page.route("**/api/booking/availability**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_AVAILABILITY) })
);

await page.route("**/api/booking/quote**", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      subtotal: 7000,
      total: 7000,
      totalTaxes: 840,
      nightlyRate: 3500,
      cancellation_policy: "Free cancellation up to 48 hours before check-in",
      quote_id: "quote-test-1",
      currency: "INR",
    }),
  })
);

await page.goto(`${BASE}/booking/`, { waitUntil: "networkidle" });

check("search panel visible on load", await page.locator("#search-section").isVisible());

await page.click("#search-btn");
await page.waitForSelector("#state-results:not(.hidden)", { timeout: 15000 });
await page.waitForTimeout(800);

check("search panel stays visible after search", await page.locator("#search-section").isVisible());

// Auto-scroll: page moved and search panel visible near top (right after results load)
const scrolled = await page.evaluate(() => window.scrollY);
check("auto-scroll moved page", scrolled > 100, `scrollY=${scrolled}`);
const searchBottom = await page.locator("#search-section").boundingBox();
if (searchBottom) {
  const bottomY = searchBottom.y + searchBottom.height;
  check("search panel visible with results below", bottomY > 0 && bottomY < 760, `bottom=${Math.round(bottomY)}`);
}

const cars = await page.locator("[data-carousel]").count();
check("carousel per room (2 rooms)", cars === 2, `found ${cars}`);

const firstCarousel = page.locator("[data-carousel]").first();

const dots = await firstCarousel.locator("[data-dot]").count();
check("7 dots per carousel", dots === 7, `found ${dots}`);
check("one active dot initially", (await firstCarousel.locator("[data-dot].is-active").count()) === 1);

const currentImgSrc = await firstCarousel
  .locator(".cfr-carousel__slide:not([aria-hidden]) img")
  .first()
  .getAttribute("src");
check("current image lazy-loaded", !!currentImgSrc && currentImgSrc.includes("rooms"), String(currentImgSrc));

const transform = async () =>
  firstCarousel.locator(".cfr-carousel__track").evaluate((el) => el.style.transform);

check("track at first slide", (await transform()) === "translateX(-100%)", await transform());

// Dot 0 -> slide 1 (reset)
await firstCarousel.locator("[data-dot]").first().click();
await page.waitForTimeout(700);
check("dot 0 -> slide 1", (await transform()) === "translateX(-100%)", await transform());

// Next -> slide 2
await firstCarousel.locator("[data-carousel-next]").click();
await page.waitForTimeout(700);
check("next moves to slide 2", (await transform()) === "translateX(-200%)", await transform());

// Dot 4 -> slide 5
await firstCarousel.locator("[data-dot]").nth(4).click();
await page.waitForTimeout(700);
check("dot click -> slide 5", (await transform()) === "translateX(-500%)", await transform());

// Back to slide 1 via dot 0
await firstCarousel.locator("[data-dot]").first().click();
await page.waitForTimeout(700);

// Infinite forward: 7 nexts from slide 1 -> back at slide 1
for (let i = 0; i < 7; i++) {
  await firstCarousel.locator("[data-carousel-next]").click();
  await page.waitForTimeout(650);
}
check("infinite loop wraps (7 nexts -> slide 1)", (await transform()) === "translateX(-100%)", await transform());

// Infinite backward: prev from slide 1 -> slide 7 (last)
await firstCarousel.locator("[data-carousel-prev]").click();
await page.waitForTimeout(700);
check("prev from slide 1 wraps to last slide", (await transform()) === "translateX(-700%)", await transform());

// Prev again -> slide 6
await firstCarousel.locator("[data-carousel-prev]").click();
await page.waitForTimeout(700);
check("prev -> slide 6", (await transform()) === "translateX(-600%)", await transform());

// Keyboard navigation: go back to slide 1, focus carousel, arrow left -> last slide
await firstCarousel.locator("[data-dot]").first().click();
await page.waitForTimeout(700);
await firstCarousel.focus();
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(700);
check("keyboard arrow left wraps to last slide", (await transform()) === "translateX(-700%)", await transform());
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(700);
check("keyboard arrow right -> slide 1", (await transform()) === "translateX(-100%)", await transform());

// Swipe right (drag right) -> previous slide (last)
const carBox = await firstCarousel.boundingBox();
const cy = carBox.y + carBox.height / 2;
await page.mouse.move(carBox.x + 300, cy);
await page.mouse.down();
await page.mouse.move(carBox.x + 450, cy, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(700);
check("swipe right -> previous slide (last)", (await transform()) === "translateX(-700%)", await transform());

// Thumbnail strip
const firstCard = page.locator("#state-results article").first();
const thumbsEl = firstCard.locator("[data-thumbs]");
check("thumbnail strip visible", await thumbsEl.isVisible());
const thumbCount = await thumbsEl.locator("[data-thumb]").count();
check("7 thumbnails per room", thumbCount === 7, String(thumbCount));
check("one active thumbnail", (await thumbsEl.locator("[data-thumb].is-active").count()) === 1);
check("active thumb follows swipe (photo 7)", ((await thumbsEl.locator("[data-thumb].is-active").getAttribute("aria-label")) || "").includes("photo 7"));
check("active thumb has aria-current", (await thumbsEl.locator("[data-thumb].is-active").getAttribute("aria-current")) === "true");

// Thumb click -> photo 4
await thumbsEl.locator("[data-thumb]").nth(3).click();
await page.waitForTimeout(700);
check("thumb click -> slide 4", (await transform()) === "translateX(-400%)", await transform());
check("clicked thumb becomes active", ((await thumbsEl.locator("[data-thumb].is-active").getAttribute("aria-label")) || "").includes("photo 4"));

// Next arrow -> active thumb follows (photo 5)
await firstCarousel.locator("[data-carousel-next]").click();
await page.waitForTimeout(700);
check("next updates active thumb", ((await thumbsEl.locator("[data-thumb].is-active").getAttribute("aria-label")) || "").includes("photo 5"));

// Wrap backwards -> active thumb follows to last
await firstCarousel.locator("[data-dot]").first().click();
await page.waitForTimeout(700);
await firstCarousel.locator("[data-carousel-prev]").click();
await page.waitForTimeout(700);
check("wrap updates active thumb to last", ((await thumbsEl.locator("[data-thumb].is-active").getAttribute("aria-label")) || "").includes("photo 7"));

// Keyboard -> active thumb follows
await firstCarousel.locator("[data-dot]").first().click();
await page.waitForTimeout(700);
await firstCarousel.focus();
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(700);
check("keyboard updates active thumb", ((await thumbsEl.locator("[data-thumb].is-active").getAttribute("aria-label")) || "").includes("photo 7"));

// Reset to slide 1 and open lightbox
await firstCarousel.locator("[data-dot]").first().click();
await page.waitForTimeout(700);
await firstCarousel.locator('[data-slide-btn][tabindex="0"]').click();
await page.waitForTimeout(400);
check("lightbox opens on image click", await page.locator("#cfr-lightbox").isVisible());
check("lightbox counter 1 of 7", (await page.locator("#cfr-lightbox-counter").textContent()) === "1 of 7");

await page.click("#cfr-lightbox-next");
await page.waitForTimeout(500);
check("lightbox next -> 2 of 7", (await page.locator("#cfr-lightbox-counter").textContent()) === "2 of 7");

// Lightbox infinite: from 2 of 7, prev twice -> 7 of 7
await page.click("#cfr-lightbox-prev");
await page.waitForTimeout(500);
check("lightbox prev -> 1 of 7", (await page.locator("#cfr-lightbox-counter").textContent()) === "1 of 7");
await page.click("#cfr-lightbox-prev");
await page.waitForTimeout(500);
check("lightbox prev wraps -> 7 of 7", (await page.locator("#cfr-lightbox-counter").textContent()) === "7 of 7");

await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("Escape closes lightbox", await page.locator("#cfr-lightbox").isHidden());

const restoredCount = await firstCarousel.locator(".cfr-carousel__slide > .cfr-carousel__img-btn > img").count();
check("carousel images restored after close", restoredCount === 9, String(restoredCount));

// Reopen lightbox and swipe left -> next
await firstCarousel.locator('[data-slide-btn][tabindex="0"]').click();
await page.waitForTimeout(400);
const lbBox = await page.locator("#cfr-lightbox-viewport").boundingBox();
const lbY = lbBox.y + lbBox.height / 2;
await page.mouse.move(lbBox.x + 600, lbY);
await page.mouse.down();
await page.mouse.move(lbBox.x + 400, lbY, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(500);
check("lightbox swipe left -> next (2 of 7)", (await page.locator("#cfr-lightbox-counter").textContent()) === "2 of 7");

await page.click("#cfr-lightbox-close");
await page.waitForTimeout(300);
check("close button closes lightbox", await page.locator("#cfr-lightbox").isHidden());

// Backdrop click closes
await firstCarousel.locator('[data-slide-btn][tabindex="0"]').click();
await page.waitForTimeout(400);
await page.mouse.click(10, 450);
await page.waitForTimeout(300);
check("backdrop click closes lightbox", await page.locator("#cfr-lightbox").isHidden());

// Amenities rendered with icons (6 items on the available room card)
const amenityCount = await page
  .locator(".select-room-btn")
  .first()
  .locator("xpath=../..")
  .locator("ul")
  .first()
  .locator("li")
  .count();
check("6 amenity items with icons", amenityCount === 6, String(amenityCount));

// Mobile responsiveness
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
const mBox = await firstCarousel.boundingBox();
const mRatio = mBox.height / mBox.width;
check("mobile carousel not excessively tall", mBox.height < 400, `h=${Math.round(mBox.height)}`);
check("mobile carousel ratio ~16/10", Math.abs(mRatio - 0.625) < 0.12, `ratio=${mRatio.toFixed(2)}`);
check("mobile arrows visible", await firstCarousel.locator("[data-carousel-next]").isVisible());

// Desktop ratio
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(400);
const dBox = await firstCarousel.boundingBox();
const dRatio = dBox.height / dBox.width;
check("desktop carousel ratio ~16/7 (0.44)", Math.abs(dRatio - 0.4375) < 0.12, `ratio=${dRatio.toFixed(3)}`);

// Search panel still visible after all interaction
check("search panel visible at end", await page.locator("#search-section").isVisible());

// Select This Room -> guest details step (mapping resolved "Family Room" -> family-lodge)
await page.locator("#state-results .select-room-btn").first().click();
await page.waitForTimeout(1200);
check("Select This Room navigates to guest details", await page.locator("#state-guests:not(.hidden)").isVisible());
check("URL step = guests", (page.url().includes("step=guests")), page.url());
const guestsVisible = await page.locator("#guest-details-form, #state-guests input").count();
check("guest form rendered", guestsVisible > 0, String(guestsVisible));

// Guest details -> review step
await page.fill("#guest-firstName", "Rahul");
await page.fill("#guest-lastName", "Sharma");
await page.fill("#guest-email", "rahul@test.com");
await page.fill("#guest-phone", "+91 98765 43210");
await page.click("#proceed-to-review");
await page.waitForTimeout(800);
check("review step visible", await page.locator("#state-review:not(.hidden)").isVisible());
const confirmBox = page.locator("#booking-confirmation");
check("confirmation checkbox present", await confirmBox.count() > 0, String(await confirmBox.count()));

// No console errors
check("no console/page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
