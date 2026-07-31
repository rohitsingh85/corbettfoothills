# Investigation — Booking Page Showing "No Rooms Available"

**Date:** 2026-07-31
**Status:** ✅ Resolved & deployed
**Impact:** Booking page (`/booking`) showed "No Rooms Available" on `corbett.life` while the upstream InnPilot API had plenty of inventory (6 rooms available for the test dates).

---

## Symptom

The booking page rendered the "No Rooms Available" empty state. The frontend was not receiving any rooms from the booking BFF, even though the upstream API (`app.inn-pilot.com`) returned valid rooms for the same dates.

---

## Root Cause

The InnPilot public API wraps **all** JSON responses in an envelope:

- **Success:** `{ success: true, data: { ... } }` (`jsonOk`)
- **Error:** `{ success: false, error: { code, message } }` (`jsonError`)

The Cloudflare Pages booking BFF (`functions/api/booking/*`) was reading the payload at the wrong level. The BFF treated `{ success: true, data: { rooms: [...] } }` as if the fields (`rooms`, `checkin`, `checkout`) lived at the top level. Since `parsed.data` was `undefined` after the unwrap, the response contained no rooms → the UI showed the empty state.

Files affected:

| File | Bug |
|------|-----|
| `functions/api/booking/availability.js` | Read `parsed.rooms` instead of `parsed.data.rooms` (lines ~148) |
| `functions/api/booking/quote.js` | Read `parsed.*` instead of `parsed.data.*` |
| `functions/api/booking/session.js` | Stored the raw wrapped quote in the session (restore path then broke `booking.astro` order summary) |

`submit.js` and `verify-payment.js` already unwrapped correctly (`data.data || data`), confirming the envelope is the source of truth.

---

## Fix

### 1. Shared helper — `functions/api/booking/_quote-transform.js`

Introduced two shared functions so all BFF endpoints use one canonical unwrap + shape:

- `unwrapInnPilotData(payload)` — returns `payload.data` when present, else the payload itself (handles legacy/non-wrapped responses).
- `transformQuote(parsed)` — maps the upstream quote shape to the camelCase BFF quote the frontend expects:
  `{ subtotal, total, totalTaxes, nightlyRate, cancellation_policy, quote_id, breakdown, currency, deposit_required, quote_expires_at, pay_at_property_allowed, room_type_description, max_occupancy, bed_config, amenities }`

### 2. Endpoint fixes

- **`availability.js`:** `parsed = parsed.data || parsed;` before reading `rooms`.
- **`quote.js`:** Use `unwrapInnPilotData` + `transformQuote`.
- **`session.js`:** Restore path now returns `quote: transformQuote(unwrapInnPilotData(quoteData))` so a restored session matches the `/quote` shape `booking.astro` expects on reload (`quoteData.total`, `quoteData.taxes`, `quoteData.cancellation_policy`).
- **`session.js` create path:** Fixed the upstream quote request key from `room_type_id` → `room_type` (matches `quote.js` and the upstream `QuoteRequestSchema`, which destructures `room_type`).

### 3. Frontend contract (unchanged, verified)

- `booking.astro` sends `room_id: roomType || roomSlug` to the BFF (`SLUG_TO_ROOM_TYPE` map).
- Availability BFF returns `room_type` per room, which the UI uses as the slug for selection.
- Order summary reads camelCase `quoteData.total` / `quoteData.taxes` / `quoteData.cancellation_policy`.

---

## Verification (live, after deploy)

| Flow | Request | Result |
|------|---------|--------|
| Availability | `GET /api/booking/availability?checkin=2026-08-10&checkout=2026-08-11&adults=2` | `{"rooms":[{"room_type":"Family Room","available":true,"roomsLeft":6,"nightlyRate":3000,...}]}` ✅ |
| Quote | `POST /api/booking/quote` `{room_id:"Family Room",checkin,checkout,adults}` | Full camelCase quote, total 3000 INR ✅ |
| Session create | `POST /api/booking/session` `{action:"create", room_id:"Family Room", ...}` | `{sessionId, serverTime, expiresAt, quote:{...camelCase}}` ✅ |
| Simulation | `node /tmp/bff-sim.mjs` | 6/6 checks pass ✅ |

**Note:** One `error code: 502` observed on session create immediately after deploy was edge-node propagation flakiness (AMS node); the same request succeeded on the next call and on the preview deployment URL.

---

## Lesson

When deploying to Cloudflare Pages (direct upload), responses can briefly reflect stale bundles from non-local edge nodes. If you see an empty/erroneous result right after `npm run cf:deploy`, re-check after ~30–60s and also against the per-deployment preview URL before assuming a regression.

---

## Files changed

- `functions/api/booking/availability.js` — unwrap fix
- `functions/api/booking/quote.js` — shared helper adoption
- `functions/api/booking/session.js` — shared helper adoption + `room_type_id` → `room_type`
- `functions/api/booking/_quote-transform.js` — **new** shared unwrap + transform
