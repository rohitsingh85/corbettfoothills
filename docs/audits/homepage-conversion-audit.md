# Homepage Conversion / Sales Effectiveness Audit

**Date:** 2026-09-04
**Scope:** `corbett.life` homepage — conversion/sales effectiveness
**Auditor:** opencode (automated)
**Status:** Audit only. One fix implemented (C03).

---

## 1. Executive Finding

The CFR homepage is visually polished and communicates the property's character well, but **it does not function as a direct-booking funnel**. The primary conversion goal — a visitor checking availability and booking a room — requires navigating away from the homepage before any booking-related action is possible. The homepage has no visible pricing, no room previews, and no direct path to the booking engine. The only on-page conversion mechanism (the contact form) is non-functional (dead `action="#"`). The site's conversion burden falls almost entirely on the persistent header "Book Now" button and the WhatsApp floating button, which are strong but indirect.

**Estimated current conversion effectiveness: 4/10** — The homepage creates desire but does not convert it.

---

## 2. Current Homepage Conversion Journey

### Visitor Flow (as designed)

```
Landing (Hero)
  └─ "Explore Stays" → /accommodation
       └─ Overview page (no room details)
            └─ CTA: "Book Your Stay" → /booking/
            └─ CTA: "View Rates & Pricing" → /tariff
                 └─ Tariff page (3 category cards, pricing)
                      └─ "Enquire About This Room" → /contact
                      └─ "Enquire Now" → /contact
```

### What the visitor sees, section by section

| Section | Content | CTA | Conversion role |
|---|---|---|---|
| **Hero** (lines 17–77) | Tagline, location badge, stats (6 rooms, 8 km, 50 m) | "Explore Stays" → `/accommodation` | Sets tone, drives to accommodation overview |
| **Features** (lines 79–131) | 4 cards: Boutique Farmstay, Nature Walks, Organic Farming, Pet-Friendly | "Read Our Travel Blog" → `/blogs` | Informational, no booking path |
| **Accommodation** (lines 133–209) | Room features list, "Who Loves Our Retreat" (6 guest types), Pet-friendly | "View All Accommodations" → `/accommodation`, "View Rates & Pricing" → `/tariff` | Describes who stays, not what rooms look like |
| **Gallery** (lines 211–245) | 3 images | "View Full Gallery" → `/gallery` | Visual appeal, no booking path |
| **Experiences** (lines 247–297) | 10 experience cards (3-col grid) | None (no link, no button) | Informational dead end |
| **About** (lines 299–316) | Pull-quote from `siteData.about.paragraphs[0]` | None | Brand storytelling, no booking path |
| **CTA/Contact** (lines 318–473) | Contact info, WhatsApp link, **dead contact form** | "Chat on WhatsApp" (functional), form submit (non-functional) | Lead capture (broken) |
| **Testimonials** (MainLayout.astro:74–146) | 3 guest reviews with 5-star ratings, Google Maps link | "View all reviews on Google Maps" | Trust/social proof |
| **Header** (Header.astro:59) | Persistent "Book Now" → `/booking/` | Direct to booking engine | Primary booking entry point |
| **Floating buttons** (MainLayout.astro:148–170) | Instagram + WhatsApp | Direct links | Always-available contact |

### Summary of all CTAs on the homepage

| CTA | Destination | Functional | Booking-related |
|---|---|---|---|
| "Explore Stays" (hero) | `/accommodation` | Yes | Indirect (→ accommodation → booking) |
| "Read Our Travel Blog" (features) | `/blogs` | Yes | No |
| "View All Accommodations" (accommodation) | `/accommodation` | Yes | Indirect |
| "View Rates & Pricing" (accommodation) | `/tariff` | Yes | Indirect |
| "View Full Gallery" (gallery) | `/gallery` | Yes | No |
| "Chat on WhatsApp" (contact) | `wa.me/...` | Yes | Indirect (conversation) |
| "Send Enquiry" (contact form) | `#` (dead) | **No** | No (broken) |
| "Book Now" (header) | `/booking/` | Yes | **Direct** |
| WhatsApp floating button | `wa.me/...` | Yes | Indirect |
| Instagram floating button | `instagram.com/...` | Yes | No |
| "View all reviews on Google Maps" (testimonials) | Google Maps | Yes | No |

**Critical observation:** Only ONE CTA on the entire homepage leads directly to the booking engine — the header "Book Now" button. Every other path requires at least 2 intermediate steps.

---

## 3. Conversion Strengths

### S1. Header "Book Now" is persistent and visible
The header `Book Now` button (`Header.astro:59`) is a rounded, high-contrast button that stays fixed at the top of every page. On homepage, it is the single most prominent direct-booking CTA. This is the site's primary conversion mechanism.

### S2. WhatsApp floating button is always accessible
The green WhatsApp button (`MainLayout.astro:160–170`) is fixed at the bottom-right with `animate-pulse`. It provides an instant, low-friction contact path that works well for the Indian market where WhatsApp is the dominant communication channel.

### S3. Testimonials are positioned with high trust signals
Three 5-star reviews with real names (Jeevan Singh, Dev Ghosh, R Singh), detailed testimonials, and a "View all reviews on Google Maps" link. The Google Maps link is a strong external validation signal. Testimonials appear on every page via `MainLayout.astro`.

### S4. Hero creates strong emotional positioning
The tagline "Where Farm life Meets Luxury" plus the italic subheading "Meets Luxury" creates a clear brand identity. The stats (6 rooms, 8 km from park gate, 50 meters from forest) are concrete, memorable differentiators. The location badge ("Jim Corbett National Park, Uttarakhand") immediately orients the visitor.

### S5. Site aesthetic communicates premium positioning
The design is cohesive, visually refined, and consistent with luxury boutique hospitality. The Playfair Display typography, the earthy green/cream palette, the photography — all communicate a premium product. This is a significant conversion asset that should not be changed.

### S6. Pricing transparency on tariff page
The tariff page (`tariff.astro`) clearly shows weekday/weekend rates (₹2,250/₹2,500 per night), cot pricing (₹750), and what's included (breakfast, parking, Wi-Fi, etc.). This is conversion-positive — visitors who reach this page have clear price anchoring.

### S7. Booking engine is functional and modern
The booking page (`booking.astro`) is a 3730-line fully-functional availability search + booking + payment flow. It supports real-time availability, room selection, guest details, Razorpay payment, and session management. The barrier is not the booking engine — it's getting visitors to it.

---

## 4. Conversion Weaknesses

### W1. No direct booking CTA on the homepage body
**Severity: P0**
The only direct booking CTA is in the header. The homepage body has zero links to `/booking/`. Every body section either links to informational pages (`/accommodation`, `/tariff`, `/gallery`, `/blogs`) or is a dead end. A visitor who scrolls past the header has no way to book without scrolling back up or finding the header.

**Evidence:** `index.astro` lines 50–58 (hero CTA → `/accommodation`), lines 196–206 (accommodation CTA → `/accommodation` + `/tariff`), lines 389–468 (contact form → `#`). Zero instances of `href="/booking/"` in the homepage body.

### W2. Hero CTA goes to `/accommodation` instead of `/booking/`
**Severity: P1**
The primary hero CTA "Explore Stays" links to `/accommodation` — a marketing overview page with no room details, no pricing, and no booking functionality. This adds an unnecessary step. The visitor must then navigate from accommodation → booking. A "Check Availability" or "Book Your Stay" CTA linking directly to `/booking/` would shorten the conversion path by one step.

**Evidence:** `index.astro:51` — `<a href="/accommodation" ...>Explore Stays</a>`

### W3. Accommodation section shows no rooms, no images, no pricing
**Severity: P0**
The homepage accommodation section (lines 133–209) shows:
- Room features list (generic: "king-size bed", "air conditioning", etc.)
- "Who Loves Our Retreat" guest type cards (6 types)
- Pet-friendly callout

It does **not** show:
- Any of the 6 actual rooms (The Forest Suite, The River Cottage, etc.)
- Any room images
- Any pricing (weekday ₹2,250, weekend ₹2,500)
- Any room-specific details (bed type, area, occupancy)

This is the section most likely to motivate a booking decision, but it contains only generic descriptors. A visitor cannot evaluate whether the property suits their needs from this section alone.

**Evidence:** `index.astro:133–209` + `site.json` `accommodationIntro` (heading + description only)

### W4. Accommodation CTA splits between two destinations
**Severity: P1**
The accommodation section has two CTAs:
- "View All Accommodations" → `/accommodation` (secondary style: outline button)
- "View Rates & Pricing" → `/tariff` (primary style: solid button)

Neither goes to `/booking/`. The visitor is分流 to two different informational pages. The primary visual weight (solid button) goes to tariff, not booking. This is a counter-intuitive priority — pricing information is less conversion-ready than the booking action itself.

**Evidence:** `index.astro:197–206`

### W5. Contact form is non-functional (C03 — fixed in this PR)
**Severity: P0 (fixed)**
The "Send Enquiry" form (`index.astro:389–468`) has `action="#"` with no JavaScript handler. Clicking "Send Enquiry" does nothing. This is the homepage's only lead-capture mechanism and it is completely broken.

**Evidence:** `index.astro:389` — `<form action="#" method="POST" ...>`

### W6. Experiences section has no CTA at all
**Severity: P2**
The 10 experience cards (lines 258–295) have images, titles, descriptions, and highlights — but zero links. No "Learn More", no "Book Experience", no link to `/experiences`. The entire section is informational with no conversion path.

**Evidence:** `index.astro:274–292` — cards have no `<a>` elements

### W7. Gallery section does not link to booking
**Severity: P2**
The gallery section shows 3 images with a "View Full Gallery" link. The visual content creates desire but there is no adjacent booking CTA to capitalize on that desire.

**Evidence:** `index.astro:236–243`

### W8. About section is a text-only quote with no action
**Severity: P2**
The about section (lines 299–316) renders a single paragraph quote with no CTA. It is pure brand storytelling with no conversion path.

**Evidence:** `index.astro:300–316`

### W9. No pricing visible anywhere on the homepage
**Severity: P1**
The homepage does not show any pricing. The tariff page (₹2,250/₹2,500 per night) is one click away, but the homepage itself has zero price signals. For a boutique property, showing a "starting from ₹2,250/night" anchor on the homepage would reduce friction for price-conscious visitors and set expectations before they reach the booking engine.

**Evidence:** No price strings anywhere in `index.astro` or `site.json`

### W10. No urgency or scarcity signals
**Severity: P2**
There is no indication of availability, seasonal demand, or booking urgency. Phrases like "Limited rooms available" or "Peak season filling fast" are absent. The property has only 6 rooms, which is inherently scarce — but this is not communicated.

---

## 5. Proposed Improvements (PROPOSED — Not Implemented)

### P0 — Critical conversion fixes

#### P0-1. Add direct booking CTA to homepage body
- **Section:** Accommodation CTA area (`index.astro:193–207`)
- **Current:** "View All Accommodations" + "View Rates & Pricing"
- **Proposed:** Add a prominent "Check Availability" or "Book Your Stay" CTA linking to `/booking/` as the primary action. Keep existing secondary CTAs.
- **Benefit:** Shortens conversion path; gives visitors a direct booking action without relying on the header.
- **Complexity:** Low — add one `<a>` element.

#### P0-2. Change hero CTA destination to `/booking/`
- **Section:** Hero (`index.astro:51`)
- **Current:** "Explore Stays" → `/accommodation`
- **Proposed:** Change to "Check Availability" → `/booking/` or add a second CTA alongside it.
- **Benefit:** Immediate path to booking from the first thing visitors see.
- **Complexity:** Low — change one `href`.

#### P0-3. Add room previews to accommodation section
- **Section:** Accommodation (`index.astro:133–209`)
- **Current:** Generic features + guest types
- **Proposed:** Show 2–3 featured rooms with image, name, short description, starting price, and "Book This Room" link to `/booking/?room={slug}`. Use data from `rooms.ts`.
- **Benefit:** Visitors can evaluate specific rooms; pricing anchor creates expectation; direct booking links shorten the path.
- **Complexity:** Medium — requires importing `rooms.ts` into the homepage frontmatter and rendering room cards.

### P1 — Important conversion improvements

#### P1-1. Add pricing anchor to homepage
- **Section:** Hero stats area (`index.astro:60–73`) or accommodation section
- **Current:** Stats show "6 Rooms", "8 km", "50 Meters"
- **Proposed:** Add "From ₹2,250/night" as a fourth stat or as a subtitle in the accommodation section.
- **Benefit:** Price anchoring reduces friction; sets expectations before booking.
- **Complexity:** Low — add one stat element or text line.

#### P1-2. Add booking CTA to experiences section
- **Section:** Experiences (`index.astro:258–295`)
- **Current:** Cards with no links
- **Proposed:** Add "Learn More" links to `/experiences` on each card, and a "Plan Your Experience" CTA below the grid linking to `/booking/`.
- **Benefit:** Converts experience interest into booking intent.
- **Complexity:** Low — add `<a>` elements.

#### P1-3. Add booking CTA after gallery section
- **Section:** Gallery (`index.astro:236–243`)
- **Current:** "View Full Gallery" link only
- **Proposed:** Add a "Ready to Experience This? Book Your Stay" CTA below the gallery link.
- **Benefit:** Capitalizes on visual desire with immediate booking action.
- **Complexity:** Low — add one `<a>` element.

#### P1-4. Strengthen accommodation CTA button hierarchy
- **Section:** Accommodation CTA (`index.astro:196–206`)
- **Current:** "View All Accommodations" (outline) + "View Rates & Pricing" (solid)
- **Proposed:** Make the booking CTA the solid/primary button; keep "View Rates" as outline/secondary.
- **Benefit:** Visual hierarchy directs visitors toward the higher-conversion action.
- **Complexity:** Low — swap button styles.

### P2 — Enhancement opportunities

#### P2-1. Add CTA to about section
- **Section:** About (`index.astro:299–316`)
- **Current:** Quote text only
- **Proposed:** Add "Discover Our Story" → `/about-us` and "Book Your Stay" → `/booking/` below the quote.
- **Benefit:** Converts brand storytelling interest into action.
- **Complexity:** Low.

#### P2-2. Add urgency/scarcity messaging
- **Section:** Hero or accommodation section
- **Current:** No availability signals
- **Propose:** Add "Only 6 rooms — book early for peak season" near the booking CTA.
- **Benefit:** Leverages the property's inherent scarcity (6 rooms) to create urgency.
- **Complexity:** Low — text addition only. Must be factually accurate.

#### P2-3. Simplify CTA count in accommodation section
- **Section:** Accommodation CTA (`index.astro:196–206`)
- **Current:** 2 CTAs (accommodations + tariff)
- **Proposed:** Consider reducing to 1 primary CTA (booking) with a subtle secondary link (tariff).
- **Benefit:** Reduces decision paralysis; focuses visitor on the highest-value action.
- **Complexity:** Low.

---

## 6. Intentional Design Decisions (No Change Required)

The following items were identified in prior audits as potential issues but are **intentional and should not be changed**:

1. **Testimonials on every page** — The testimonial section in `MainLayout.astro` renders on all pages including booking, 404, and confirmation. This is intentional social proof placement and should remain.

2. **Playfair Display for both headings and body** — The typography choice is intentional brand design. Both `font-display` and `font-body` are Playfair Display in `tailwind.config.mjs`. This should remain as-is.

3. **Single accommodation overview page** — The site has one `/accommodation` page rather than individual room pages. This is a deliberate architectural decision. The audit does not recommend creating individual room pages.

4. **WhatsApp as primary contact channel** — The prominent WhatsApp button reflects the Indian market preference for WhatsApp communication. This is conversion-appropriate for the target audience.

5. **Testimonial content and names** — The three testimonials (Jeevan Singh, Dev Ghosh, R Singh) are real guest reviews. No fabricated or invented testimonials.

---

## 7. Conversion Journey Gap Summary

```
DESIRE CREATED: Hero → Features → Gallery → Experiences → About → Testimonials
                                                      ↓
CONVERSION PATH: Header "Book Now" (only direct path)
                                                      ↓
                 Body CTAs → /accommodation → /tariff → /contact (indirect)
                                                      ↓
BOOKING ENGINE: /booking/ (functional, noindex)
```

**The gap:** Desire creation and conversion action are structurally disconnected. The homepage builds aspiration for 6+ sections but offers no direct booking action within the page body. The entire conversion burden falls on the header button and floating WhatsApp button.

**The opportunity:** Adding 2–3 strategically placed booking CTAs within the homepage body (after hero, after accommodation, after gallery) would create multiple conversion touchpoints without changing the site's design character.

---

*End of audit. C03 fix implemented separately — see git diff.*
