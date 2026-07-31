// Canonical shared helper for the booking BFF.
//
// InnPilot wraps every successful API response as `{ success: true, data: {...} }`
// and every error as `{ success: false, error: { code, message } }` (see
// `src/lib/api-response.ts` in the InnPilot repo). Every BFF endpoint MUST unwrap
// the `data` envelope through this single helper before reading payload fields —
// no endpoint should reimplement the unwrap inline.

/**
 * Unwrap the InnPilot `data` envelope.
 *
 * - `{ success: true, data: {...} }`  → returns the inner payload
 * - `{ success: false, error: {...} }` → returns the envelope unchanged (error
 *   responses are forwarded as-is by callers)
 * - already-unwrapped / legacy payloads → returned unchanged
 * - `null`, `undefined`, arrays, and primitives → returned unchanged
 * - `{ ..., data: null | undefined }` → returned unchanged (no payload to read)
 *
 * The unwrap is deliberately a single level: a payload that legitimately
 * contains a nested `data` field is never re-unwrapped. The helper never throws.
 */
export function unwrapInnPilotData(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  if (payload.success === false) {
    return payload;
  }
  if (payload.data !== undefined && payload.data !== null) {
    return payload.data;
  }
  return payload;
}
