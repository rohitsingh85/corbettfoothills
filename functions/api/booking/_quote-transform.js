// Shared helper for the booking BFF.
//
// Transforms the InnPilot quote payload (snake_case) into the camelCase shape
// the frontend expects. Envelope unwrapping lives in `_response-envelope.js`.

export function transformQuote(parsed) {
  return {
    subtotal: parsed.room_subtotal ?? 0,
    total: parsed.total ?? 0,
    totalTaxes: parsed.tax_amount ?? 0,
    nightlyRate: parsed.nightly_rate ?? 0,
    cancellation_policy:
      parsed.cancellation_policy?.name ||
      parsed.cancellation_policy?.description ||
      "",
    quote_id: null,
    // Forward these as-is for potential frontend use
    breakdown: parsed.breakdown,
    currency: parsed.currency,
    deposit_required: parsed.deposit_required,
    quote_expires_at: parsed.quote_expires_at,
    pay_at_property_allowed: parsed.pay_at_property_allowed,
    // InnPilot's server-computed extra-bedding charge for the stay, already
    // included in `total`. Falls back to null so the frontend can keep its
    // display-only fallback against older servers.
    bedding_subtotal: parsed.bedding_subtotal ?? null,
    room_type_description: parsed.room_type_description,
    max_occupancy: parsed.max_occupancy,
    max_adults: parsed.max_adults,
    max_children: parsed.max_children,
    rooms_required: parsed.rooms_required ?? 1,
    minimum_rooms: parsed.minimum_rooms ?? 1,
    availability_error: parsed.availability_error ?? null,
    // InnPilot's per-night allocation options for the requested dates — the
    // frontend renders them verbatim so the customer can pick their mix.
    allocation_options: parsed.allocation_options ?? null,
    // InnPilot's deterministic per-room guest split — forwarded for the
    // frontend to render verbatim (CFR never reconstructs allocation).
    allocation: parsed.allocation ?? null,
    bed_config: parsed.bed_config,
    amenities: parsed.amenities,
  };
}
