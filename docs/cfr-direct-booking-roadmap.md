# CFR Direct Booking — Implementation Roadmap

## Architecture

Browser → CFR BFF (`/api/booking/*`) → InnPilot API.
Only the CFR server holds `BOOKING_API_KEY`. The browser never sees secrets.
Static site on Cloudflare Pages (`output: "static"`, `@astrojs/cloudflare` adapter).

## Batch 2 — Search & Availability UI ✅

- `src/data/rooms.ts` — 6 room content records (forest-suite, river-cottage, canopy-retreat, wildlife-den, corbett-view, the-penthouse)
- `src/lib/availability.ts` — typed API client, `formatCurrency`, `formatDate`, date helpers
- `src/pages/booking.astro` — hero, search form, 5 states (initial/loading/error/empty/results), room cards, trust strip
- `src/styles/global.css` — skeleton shimmer, room-card-enter animations, reduced motion support

## Batch 2.5 — BFF Proxy ✅

- `functions/api/booking/availability.js` — proxies InnPilot `GET /v1/availability`, rate limits (30 req/min), CORS, error sanitization, 15s timeout
- `BOOKING_API_KEY` secret in Cloudflare Pages (verified via `wrangler pages secret list`)

## Batch 3B — Guest Details & Booking Flow ✅

- `functions/api/booking/quote.js` — BFF POST endpoint proxying InnPilot Quote API
- `functions/api/booking/submit.js` — placeholder POST endpoint (501, payment not implemented)
- `src/pages/booking.astro` — multi-step flow (Search → Results → Guest Details → Review), URL state management, quote fetching, booking submission
- `src/components/booking/BookingSummary.astro` — sticky sidebar (desktop) / bottom bar (mobile)
- `src/components/booking/GuestDetailsForm.astro` — accessible form with validation
- `src/components/booking/ReviewStep.astro` — booking review with confirmation checkbox

## Batch 4B — Customer Payment Experience ✅

### Booking Session Lifecycle

- `src/types/booking-session.ts` — TypeScript types for session, steps, payment methods, statuses, expiry constants
- `src/lib/booking-session.ts` — session lifecycle manager (create, persist, load, clear, server time sync, countdown helpers)
- `functions/api/booking/session.js` — BFF endpoint: GET (server timestamp), POST (create/validate session with InnPilot revalidation)

### Session Timer & Expiry

- **Duration:** 5 minutes from creation
- **Color transitions:** Green (>2min) → Amber (≤2min) → Red (≤1min)
- **Progress bar:** depletes over 5 minutes with smooth transition
- **Accessibility:** `role="timer"`, `aria-live="polite"`, sr-only announcements every 30s
- **Reduced motion:** animations disabled via `prefers-reduced-motion: reduce`
- **Server time:** fetched from BFF on session creation to prevent client clock manipulation
- **Session expiry:** clears booking state, shows "Session Expired" screen with "Search Again" button

### Session Recovery

- Session persisted to `sessionStorage` on every state change
- On page refresh: loads from sessionStorage, validates expiry, restores payment step
- URL state updated with `step=payment` for direct deep-link recovery
- Server timestamp fetched to recalibrate client clock

### Payment Method Selection

- `src/components/booking/PaymentMethodSelection.astro` — three options:
  - **UPI QR Code** — scan with Google Pay, PhonePe, Paytm, etc.
  - **Pay via UPI App** — launch preferred UPI app directly
  - **Pay at Check-in** — reserve now, pay at property (cash/card/UPI)
- Radio group with accessible labels, professional card design
- Selection persisted to session, updates `paymentMethod` and `paymentStatus`

### Placeholder Screens

- `src/components/booking/PlaceholderUPIQR.astro` — "Dynamic QR will appear here after payment gateway integration"
- `src/components/booking/PlaceholderUPIApp.astro` — Google Pay, PhonePe, Paytm, BHIM UPI buttons (disabled, "Coming soon")
- `src/components/booking/PayAtCheckin.astro` — explains: reservation confirmed after submission, accepted payment methods at property

### Navigation Protection

- `beforeunload` event warns user when leaving with an active session
- Only active when session exists, is not expired, and payment is not completed

### Flow

Search → Rooms → Select Room → Guest Details → Review → **Payment Method** → Placeholder / Pay-at-Check-in

### What's NOT implemented (by design)

- No QR code generation
- No dummy payment success buttons that bypass the state machine

## Next Batches

### Batch 6 — Confirmation & Post-Booking (future)
- Booking confirmation emails (Cloudflare Email Service)
- Booking management (modify/cancel)
- Guest dashboard

## Razorpay Webhook

- **Production webhook endpoint:** `https://app.inn-pilot.com/api/public/payment/razorpay-webhook`
- Configured in the Razorpay Dashboard under **Settings → Webhooks**
- Requires `RAZORPAY_WEBHOOK_SECRET` set on both the Cloudflare Pages environment and the InnPilot Worker
- The webhook is managed server-side by InnPilot; no client-side handler exists in this repository

## File Inventory

```
functions/api/booking/
  availability.js        — BFF proxy for availability
  quote.js              — BFF proxy for quote
  session.js            — BFF session create/validate
  submit.js             — BFF booking submit (placeholder)

src/types/
  booking-session.ts    — session TypeScript types

src/lib/
  availability.ts       — API client types and helpers
  booking-session.ts    — session lifecycle manager

src/components/booking/
  BookingSummary.astro  — booking summary sidebar/bar
  GuestDetailsForm.astro — guest details form
  ReviewStep.astro      — booking review step
  SessionCountdown.astro — countdown timer
  PaymentMethodSelection.astro — payment method picker
  PlaceholderUPIQR.astro — UPI QR placeholder
  PlaceholderUPIApp.astro — UPI app placeholder
  PayAtCheckin.astro    — pay at check-in info

src/pages/
  booking.astro         — main booking page (all steps)

src/__tests__/
  booking-session.test.ts — type/shape tests
  session-logic.test.ts  — expiry, formatting, state, persistence tests

docs/
  cfr-direct-booking-roadmap.md — this file
```
