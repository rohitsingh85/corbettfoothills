import { chromium } from "playwright";

const BASE = "http://localhost:8788";

const NIGHTLY_RATE = 3500;

function nightsBetween(checkin, checkout) {
  if (!checkin || !checkout) return 2;
  const a = new Date(checkin + "T00:00:00Z");
  const b = new Date(checkout + "T00:00:00Z");
  const n = Math.round((b - a) / 86400000);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

// Mirror of InnPilot's `computeRoomsRequired` (children placed first into
// least-loaded rooms, then adults) so the E2E mock stays faithful to the
// production source of truth.
function computeRoomsRequired(maxAdults, maxChildren, maxOccupancy, adults, children) {
  const a = Math.max(0, Number(adults) || 0);
  const c = Math.max(0, Number(children) || 0);
  if (a + c === 0) return null;
  const canFit = (rooms) => {
    if (a > rooms * maxAdults) return false;
    if (c > rooms * maxChildren) return false;
    if (a + c > rooms * maxOccupancy) return false;
    const childPer = new Array(rooms).fill(0);
    for (let i = 0; i < c; i++) {
      let best = 0;
      for (let r = 1; r < rooms; r++) if (childPer[r] < childPer[best]) best = r;
      childPer[best]++;
    }
    const adultPer = new Array(rooms).fill(0);
    for (let i = 0; i < a; i++) {
      let best = -1;
      for (let r = 0; r < rooms; r++) {
        if (adultPer[r] >= maxAdults) continue;
        if (adultPer[r] + childPer[r] >= maxOccupancy) continue;
        if (best === -1 || adultPer[r] + childPer[r] < adultPer[best] + childPer[best]) best = r;
      }
      if (best === -1) return false;
      adultPer[best]++;
    }
    return true;
  };
  for (let k = 1; k <= 12; k++) if (canFit(k)) return k;
  return null;
}

// Mirror of InnPilot's `computeRoomAllocation`: deterministic per-room adult/
// child split matching the greedy above.
function computeRoomAllocation(maxAdults, maxChildren, maxOccupancy, adults, children) {
  const a = Math.max(0, Number(adults) || 0);
  const c = Math.max(0, Number(children) || 0);
  if (a + c === 0) return null;
  const rooms = computeRoomsRequired(maxAdults, maxChildren, maxOccupancy, a, c);
  if (rooms === null) return null;
  const childPer = new Array(rooms).fill(0);
  for (let i = 0; i < c; i++) {
    let best = 0;
    for (let r = 1; r < rooms; r++) if (childPer[r] < childPer[best]) best = r;
    childPer[best]++;
  }
  const adultPer = new Array(rooms).fill(0);
  for (let i = 0; i < a; i++) {
    let best = -1;
    for (let r = 0; r < rooms; r++) {
      if (adultPer[r] >= maxAdults) continue;
      if (adultPer[r] + childPer[r] >= maxOccupancy) continue;
      if (best === -1 || adultPer[r] + childPer[r] < adultPer[best] + childPer[best]) best = r;
    }
    if (best === -1) return null;
    adultPer[best]++;
  }
  return Array.from({ length: rooms }, (_, i) => ({ adults: adultPer[i], children: childPer[i] }));
}

function buildAvailability(checkin, checkout, adults, children) {
  const nights = nightsBetween(checkin, checkout);
  // Deluxe Room is normally unavailable in the mock; it is made available for
  // the 6A+4C scenario so we can assert the party still cannot fit it (only 1
  // room left, but 4 are required) — button gated.
  const deluxeAvailable = adults === 6 && children === 4;

  const familyRoomsRequired = computeRoomsRequired(3, 2, 5, adults, children);
  const familyRoomsLeft = 2;
  const familyFits = familyRoomsRequired !== null && familyRoomsRequired <= familyRoomsLeft;

  const deluxeRoomsRequired = computeRoomsRequired(2, 1, 3, adults, children);
  const deluxeRoomsLeft = deluxeAvailable ? 1 : 0;
  const deluxeFits = deluxeRoomsRequired !== null && deluxeRoomsRequired <= deluxeRoomsLeft;

  return {
    rooms: [
      {
        slug: "Family Room",
        room_type: "Family Room",
        name: "Family Room",
        available: familyRoomsLeft > 0,
        fits: familyFits,
        rooms_required: familyFits ? familyRoomsRequired : null,
        allocation: familyFits ? computeRoomAllocation(3, 2, 5, adults, children) : null,
        roomsLeft: familyRoomsLeft,
        nightlyRate: NIGHTLY_RATE,
        originalNightlyRate: 4000,
        totalStay: NIGHTLY_RATE * nights,
        originalTotal: 4000 * nights,
        grandTotal: NIGHTLY_RATE * nights,
        taxBreakdown: [{ label: "GST 12%", amount: Math.round(NIGHTLY_RATE * nights * 0.12) }],
        totalTaxes: Math.round(NIGHTLY_RATE * nights * 0.12),
        cancellationPolicy: "Free cancellation up to 48 hours before check-in",
        max_adults: 3,
        max_children: 2,
        max_occupancy: 5,
        occupancy: {
          maxAdults: 3,
          maxChildren: 2,
          maxOccupancy: 5,
          roomsRequired: familyFits ? familyRoomsRequired : null,
          fits: familyFits,
          allocation: familyFits ? computeRoomAllocation(3, 2, 5, adults, children) : null,
          label: "Sleeps 5",
        },
      },
      {
        slug: "forest-suite",
        room_type: "Deluxe Room",
        name: "Deluxe Room",
        available: deluxeRoomsLeft > 0,
        fits: deluxeFits,
        rooms_required: deluxeFits ? deluxeRoomsRequired : null,
        allocation: deluxeFits ? computeRoomAllocation(2, 1, 3, adults, children) : null,
        roomsLeft: deluxeRoomsLeft,
        nightlyRate: 3200,
        originalNightlyRate: null,
        totalStay: 3200 * nights,
        originalTotal: null,
        grandTotal: 3200 * nights,
        taxBreakdown: [],
        totalTaxes: 0,
        cancellationPolicy: "",
        max_adults: 2,
        max_children: 1,
        max_occupancy: 3,
        occupancy: {
          maxAdults: 2,
          maxChildren: 1,
          maxOccupancy: 3,
          roomsRequired: deluxeFits ? deluxeRoomsRequired : null,
          fits: deluxeFits,
          allocation: deluxeFits ? computeRoomAllocation(2, 1, 3, adults, children) : null,
          label: "Sleeps 3",
        },
      },
    ],
    checkin,
    checkout,
  };
}

function buildQuote(body) {
  const nights = nightsBetween(body.checkin, body.checkout);
  const adults = Number(body.adults) || 0;
  const children = Number(body.children) || 0;
  const family = /family/i.test(body.room_id || "");
  const cfg = family
    ? { maxAdults: 3, maxChildren: 2, maxOccupancy: 5 }
    : { maxAdults: 2, maxChildren: 1, maxOccupancy: 3 };
  const roomsRequired = computeRoomsRequired(cfg.maxAdults, cfg.maxChildren, cfg.maxOccupancy, adults, children);
  if (roomsRequired === null) {
    return { error: "Party does not fit this room type" };
  }
  const allocation = computeRoomAllocation(cfg.maxAdults, cfg.maxChildren, cfg.maxOccupancy, adults, children);
  const total = roomsRequired * NIGHTLY_RATE * nights;
  return {
    subtotal: total,
    total,
    totalTaxes: Math.round(total * 0.12),
    taxBreakdown: [{ label: "GST 12%", amount: Math.round(total * 0.12) }],
    room_subtotal: total,
    room_count: roomsRequired,
    rooms_required: roomsRequired,
    allocation,
    occupancy: {
      maxAdults: cfg.maxAdults,
      maxChildren: cfg.maxChildren,
      maxOccupancy: cfg.maxOccupancy,
      roomsRequired,
    },
    max_adults: cfg.maxAdults,
    max_children: cfg.maxChildren,
    max_occupancy: cfg.maxOccupancy,
    nightlyRate: NIGHTLY_RATE,
    cancellation_policy: "Free cancellation up to 48 hours before check-in",
    quote_id: "quote-test-" + nights + "-" + adults + "-" + children + "-" + roomsRequired,
    currency: "INR",
  };
}

const results = [];

function fmtDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
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

await page.route("**/api/booking/availability**", (route) => {
  const u = new URL(route.request().url());
  const checkin = u.searchParams.get("checkin");
  const checkout = u.searchParams.get("checkout");
  const adults = parseInt(u.searchParams.get("adults") || "2", 10);
  const children = parseInt(u.searchParams.get("children") || "0", 10);
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(buildAvailability(checkin, checkout, adults, children)),
  });
});

await page.route("**/api/booking/quote**", (route) => {
  let body = {};
  try {
    body = JSON.parse(route.request().postData() || "{}");
  } catch {}
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(buildQuote(body)),
  });
});

await page.route("**/api/booking/session**", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ serverTime: Date.now() }),
  })
);

await page.goto(`${BASE}/booking/`, { waitUntil: "networkidle" });

check("search panel visible on load", await page.locator("#search-section").isVisible());

// First flow = 2 nights (mirrors the reported payment-exit bug baseline)
await page.fill("#checkin", fmtDate(1));
await page.fill("#checkout", fmtDate(3));
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

// Per-room occupant allocation (2A+0C -> single room, alternating icons)
const firstCardAlloc = page.locator("#state-results article").first().locator("[data-allocation]");
check("2A card shows allocation block", (await firstCardAlloc.count()) === 1);
check("2A allocation has one room row", (await firstCardAlloc.locator("li").count()) === 1);
const allocLabelA = (await firstCardAlloc.locator("li").first().getAttribute("aria-label")) || "";
check("2A allocation row = Room 1: 2 adults", allocLabelA === "Room 1: 2 adults", allocLabelA);
const allocSvgsA = await firstCardAlloc.locator("li").first().locator("svg").count();
check("2A row renders 2 adult icons (male+female)", allocSvgsA === 2, String(allocSvgsA));

// Mobile responsiveness
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
const mBox = await firstCarousel.boundingBox();
const mRatio = mBox.height / mBox.width;
check("mobile carousel not excessively tall", mBox.height < 400, `h=${Math.round(mBox.height)}`);
check("mobile carousel ratio ~4/3", Math.abs(mRatio - 0.75) < 0.12, `ratio=${mRatio.toFixed(2)}`);
check("mobile arrows visible", await firstCarousel.locator("[data-carousel-next]").isVisible());

// Desktop ratio
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(400);
const dBox = await firstCarousel.boundingBox();
const dRatio = dBox.height / dBox.width;
check("desktop carousel ratio ~3/2 (0.67)", Math.abs(dRatio - 0.6667) < 0.12, `ratio=${dRatio.toFixed(3)}`);

// Search panel still visible after all interaction
check("search panel visible at end", await page.locator("#search-section").isVisible());

// Select This Room -> guest details step (mapping resolved "Family Room" -> family-lodge)
await page.locator("#state-results .select-room-btn").first().click();
await page.waitForTimeout(1200);
check("Select This Room navigates to guest details", await page.locator("#state-guests:not(.hidden)").isVisible());
check("URL step = guests", (page.url().includes("step=guests")), page.url());
const guestsBox = await page.locator("#state-guests").boundingBox();
check("guest details scrolled below header", !!guestsBox && guestsBox.y >= 200 && guestsBox.y < 360, `top=${Math.round(guestsBox?.y ?? -1)}`);
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

// ---- Booking flow: review -> complete -> payment ----

const summaryText = (await page.locator("[data-booking-summary]").first().textContent()) || "";
check("summary shows room + total", summaryText.includes("7,000") && summaryText.length > 20, summaryText.slice(0, 60));

const stayInfoText = ((await page.locator("#review-stay-info").textContent()) || "").trim();
check("review stay info = dates + nights only", stayInfoText.includes("2 nights") && !/adult/i.test(stayInfoText), stayInfoText);
const guestsInfoText = ((await page.locator("#review-guests-info").textContent()) || "").trim();
check("review guests info shows guest count", /2 Adults/.test(guestsInfoText), guestsInfoText);

const stickyInfo = await page.evaluate(() => {
  const aside = [...document.querySelectorAll('aside[aria-label="Booking summary"]')].find(
    (a) => a.offsetParent !== null
  );
  if (!aside) return null;
  const cs = getComputedStyle(aside);
  const box = aside.getBoundingClientRect();
  return { position: cs.position, top: Math.round(box.top), height: Math.round(box.height) };
});
check(
  "summary sticky below header (not clipped)",
  !!stickyInfo && stickyInfo.position === "sticky" && stickyInfo.top >= 200 && stickyInfo.height <= 700,
  JSON.stringify(stickyInfo)
);

const desktopBtn = page.locator("#complete-booking-btn");
check("desktop Complete button present", (await desktopBtn.count()) === 1);
check("desktop Complete button disabled until confirmed", await desktopBtn.isDisabled());
check("mobile bar hidden on desktop", await page.locator("#mobile-booking-bar").isHidden());

await confirmBox.check();
await page.waitForTimeout(200);
check("Complete button enabled after confirmation", !(await desktopBtn.isDisabled()));

await desktopBtn.click();
await page.waitForTimeout(600);
check("Complete -> payment step", await page.locator("#state-payment:not(.hidden)").isVisible());
check("payment URL step", page.url().includes("step=payment"), page.url());
check("session persisted", await page.evaluate(() => !!sessionStorage.getItem("cfr_booking_session")));

// Refresh at payment -> session recovery restores payment
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("refresh at payment restores payment step", await page.locator("#state-payment:not(.hidden)").isVisible());

// Back -> review restored from session
await page.goBack();
await page.waitForTimeout(600);
check("back from payment -> review", await page.locator("#state-review:not(.hidden)").isVisible());
check("review summary restored", ((await page.locator("[data-booking-summary]").first().textContent()) || "").includes("7,000"));
check("guest details restored in review", ((await page.locator("#review-guest-name").textContent()) || "").includes("Rahul"));

// Forward -> payment again
await page.goForward();
await page.waitForTimeout(600);
check("forward -> payment restored", await page.locator("#state-payment:not(.hidden)").isVisible());

// Mobile: go back to review, mobile bar button completes booking
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await page.goBack();
await page.waitForTimeout(600);
check("mobile bar visible on review", await page.locator("#mobile-booking-bar").isVisible());
const mobileBtn = page.locator("#mobile-complete-booking-btn");
check("mobile Complete button present", (await mobileBtn.count()) === 1);
check("mobile Complete button disabled until confirmed", await mobileBtn.isDisabled());
await page.locator("#booking-confirmation").check();
await page.waitForTimeout(200);
check("mobile Complete button enabled after confirmation", !(await mobileBtn.isDisabled()));
await mobileBtn.click();
await page.waitForTimeout(600);
check("mobile Complete -> payment step", await page.locator("#state-payment:not(.hidden)").isVisible());

await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(400);

// ---- Pricing reset: payment exit -> new 1-night search must NOT reuse stale 2-night quote ----
await page.evaluate(() => window.scrollTo(0, 0));
await page.fill("#checkin", fmtDate(1));
await page.fill("#checkout", fmtDate(2));
await page.click("#search-btn");
await page.waitForSelector("#state-results:not(.hidden)", { timeout: 15000 });
await page.waitForTimeout(800);

const resetSummary = ((await page.locator("[data-booking-summary]").first().textContent()) || "").trim();
check("new search resets summary to placeholder", resetSummary.includes("Select a room"), resetSummary.slice(0, 60));

await page.locator("#state-results .select-room-btn").first().click();
await page.waitForTimeout(1200);
check("fresh 1-night search -> guest details", await page.locator("#state-guests:not(.hidden)").isVisible());
const freshSummary = ((await page.locator("[data-booking-summary]").first().textContent()) || "").trim();
check("1-night search shows ₹3,500 (not stale ₹7,000)", freshSummary.includes("3,500") && !freshSummary.includes("7,000"), freshSummary.slice(0, 80));

await page.fill("#guest-firstName", "Priya");
await page.fill("#guest-lastName", "Verma");
await page.fill("#guest-email", "priya@test.com");
await page.fill("#guest-phone", "+91 90000 12345");
await page.click("#proceed-to-review");
await page.waitForTimeout(800);
check("fresh 1-night review visible", await page.locator("#state-review:not(.hidden)").isVisible());
const freshStay = ((await page.locator("#review-stay-info").textContent()) || "").trim();
check("1-night review shows 1 night (not 2)", freshStay.includes("1 night") && !/2 nights/.test(freshStay), freshStay);
const freshTotal = ((await page.locator("[data-booking-summary]").first().textContent()) || "").trim();
check("1-night review total ₹3,500 (not ₹7,000)", freshTotal.includes("3,500") && !freshTotal.includes("7,000"), freshTotal.slice(0, 80));

// ---- Occupancy & cot: mandatory cot (3 adults + 1 child) ----
await page.evaluate(() => window.scrollTo(0, 0));
await page.fill("#checkin", fmtDate(1));
await page.fill("#checkout", fmtDate(3));
await page.selectOption("#adults", "3");
await page.selectOption("#children", "1");
await page.click("#search-btn");
await page.waitForSelector("#state-results:not(.hidden)", { timeout: 15000 });
await page.waitForTimeout(800);

const familyCardA = page.locator("#state-results article").first();
const famTextA = (await familyCardA.textContent()) || "";
check("3A+1C family card selectable", (await familyCardA.locator(".select-room-btn").isEnabled()) === true);
check("3A+1C no cot checkbox (InnPilot decides occupancy)", (await familyCardA.locator("[data-cot-check]").count()) === 0);
check("3A+1C no cot notice on family card", !/cot/i.test(famTextA), famTextA.slice(0, 90));
const allocLabel3A1C = (await familyCardA.locator("[data-allocation] li").first().getAttribute("aria-label")) || "";
check("3A+1C allocation row = Room 1: 3 adults, 1 child", allocLabel3A1C === "Room 1: 3 adults, 1 child", allocLabel3A1C);
const iconCounts3A1C = await familyCardA.locator("[data-allocation] svg").evaluateAll((els) => ({ adult: els.filter((e) => e.classList.contains("text-cfr-green-accent")).length, child: els.filter((e) => e.classList.contains("text-cfr-green-leaf")).length }));
check("3A+1C icons = 3 adult + 1 child", iconCounts3A1C.adult === 3 && iconCounts3A1C.child === 1, JSON.stringify(iconCounts3A1C));

await familyCardA.locator(".select-room-btn").click();
await page.waitForTimeout(1200);
await page.fill("#guest-firstName", "Amit");
await page.fill("#guest-lastName", "Kumar");
await page.fill("#guest-email", "amit@test.com");
await page.fill("#guest-phone", "+91 91111 00000");
await page.click("#proceed-to-review");
await page.waitForTimeout(800);
const oneRoomSummaryA = ((await page.locator("[data-booking-summary]").first().textContent()) || "").trim();
check("3A+1C total ₹7,000 (single room, no cot)", oneRoomSummaryA.includes("7,000"), oneRoomSummaryA.slice(0, 120));
const pricingA = ((await page.locator("#review-pricing").textContent()) || "").trim();
check("3A+1C review has no Extra cot line", !/Extra cot/.test(pricingA), pricingA.slice(0, 120));

// ---- Occupancy: 2 adults + 2 children -> single room, no cot UI ----
await page.evaluate(() => window.scrollTo(0, 0));
await page.fill("#checkin", fmtDate(1));
await page.fill("#checkout", fmtDate(3));
await page.selectOption("#adults", "2");
await page.selectOption("#children", "2");
await page.click("#search-btn");
await page.waitForSelector("#state-results:not(.hidden)", { timeout: 15000 });
await page.waitForTimeout(800);

const familyCardB = page.locator("#state-results article").first();
check("2A+2C no optional cot checkbox (InnPilot decides occupancy)", (await familyCardB.locator("[data-cot-check]").count()) === 0);

await familyCardB.locator(".select-room-btn").click();
await page.waitForTimeout(1200);
await page.fill("#guest-firstName", "Neha");
await page.fill("#guest-lastName", "Gupta");
await page.fill("#guest-email", "neha@test.com");
await page.fill("#guest-phone", "+91 92222 11111");
await page.click("#proceed-to-review");
await page.waitForTimeout(800);
const noCotSummary = ((await page.locator("[data-booking-summary]").first().textContent()) || "").trim();
check("2A+2C -> ₹7,000, no cot line", noCotSummary.includes("7,000") && !/Extra cot/.test(noCotSummary), noCotSummary.slice(0, 120));

// ---- Occupancy: 6A+4C -> 2 rooms required; Deluxe gated (needs 4 rooms, 1 left) ----
await page.evaluate(() => window.scrollTo(0, 0));
await page.fill("#checkin", fmtDate(1));
await page.fill("#checkout", fmtDate(3));
await page.selectOption("#adults", "6");
await page.selectOption("#children", "4");
await page.click("#search-btn");
await page.waitForSelector("#state-results:not(.hidden)", { timeout: 15000 });
await page.waitForTimeout(800);

const cardsC = page.locator("#state-results article");
const famCardC = cardsC.nth(0);
const deluxeCard = cardsC.nth(1);
const famTextC = (await famCardC.textContent()) || "";
check("6A+4C family card shows rooms-required heading", /Rooms required: 2/.test(famTextC), famTextC.slice(0, 90));
check("6A+4C family card selectable", (await famCardC.locator(".select-room-btn").isEnabled()) === true);
check("6A+4C family card shows per-room allocation rows", (await famCardC.locator("[data-allocation] li").count()) === 2);
const allocLabelsC = await famCardC.locator("[data-allocation] li").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
check("6A+4C allocation splits 3A+2C per room", JSON.stringify(allocLabelsC) === JSON.stringify(["Room 1: 3 adults, 2 children", "Room 2: 3 adults, 2 children"]), JSON.stringify(allocLabelsC));
const famIconCountsC = await famCardC.locator("[data-allocation] svg").evaluateAll((els) => ({ total: els.length, adult: els.filter((e) => e.classList.contains("text-cfr-green-accent")).length, child: els.filter((e) => e.classList.contains("text-cfr-green-leaf")).length }));
check("6A+4C icons: 6 adults + 4 children rendered", famIconCountsC.total === 10 && famIconCountsC.adult === 6 && famIconCountsC.child === 4, JSON.stringify(famIconCountsC));
check("6A+4C deluxe card gated (too many guests)", (await deluxeCard.locator('button', { hasText: "Too many guests" }).count()) === 1);

await famCardC.locator(".select-room-btn").click();
await page.waitForTimeout(1200);
await page.fill("#guest-firstName", "Sunil");
await page.fill("#guest-lastName", "Arora");
await page.fill("#guest-email", "sunil@test.com");
await page.fill("#guest-phone", "+91 93333 22222");
await page.click("#proceed-to-review");
await page.waitForTimeout(800);
const multiSummary = ((await page.locator("[data-booking-summary]").first().textContent()) || "").trim();
check("6A+4C total ₹14,000 (2 rooms, no cots)", multiSummary.includes("14,000"), multiSummary.slice(0, 140));
check("6A+4C summary shows 2 Rooms required", /2 Rooms required/.test(multiSummary), multiSummary.slice(0, 140));
const multiPricing = ((await page.locator("#review-pricing").textContent()) || "").trim();
check("6A+4C pricing shows 2 × room, no Extra cot line", /2 \u00d7/.test(multiPricing) && !/Extra cot/.test(multiPricing), multiPricing.slice(0, 140));

// Allocation block rendered verbatim in summary + review guests info
const summaryAlloc = page.locator("[data-booking-summary]").first().locator("[data-allocation]");
check("6A+4C summary shows allocation block", (await summaryAlloc.count()) === 1);
check("6A+4C summary allocation rows = 2", (await summaryAlloc.locator("li").count()) === 2);
const reviewGuestsAlloc = page.locator("#review-guests-info").locator("[data-allocation]");
check("6A+4C review guests block shows allocation", (await reviewGuestsAlloc.count()) === 1);
const reviewGuestsLabels = await page.locator("#review-guests-info [data-allocation] li").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
check("6A+4C review allocation splits per room", JSON.stringify(reviewGuestsLabels) === JSON.stringify(["Room 1: 3 adults, 2 children", "Room 2: 3 adults, 2 children"]), JSON.stringify(reviewGuestsLabels));

// No console errors
check("no console/page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
