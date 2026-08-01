import { describe, it, expect } from "vitest";
import { transformQuote } from "../../functions/api/booking/_quote-transform.js";

describe("transformQuote", () => {
  it("maps InnPilot snake_case quote fields to the frontend camelCase contract", () => {
    const parsed = {
      room_subtotal: 18000,
      total: 19800,
      tax_amount: 1800,
      nightly_rate: 4500,
      cancellation_policy: { name: "Free cancellation until 7 days before check-in" },
      quote_expires_at: "2026-08-02T00:00:00Z",
    };

    const result = transformQuote(parsed);

    expect(result.subtotal).toBe(18000);
    expect(result.total).toBe(19800);
    expect(result.totalTaxes).toBe(1800);
    expect(result.nightlyRate).toBe(4500);
    expect(result.cancellation_policy).toBe(
      "Free cancellation until 7 days before check-in"
    );
  });

  it("falls back to the cancellation policy description when name is absent", () => {
    const result = transformQuote({
      cancellation_policy: { description: "Non-refundable" },
    });
    expect(result.cancellation_policy).toBe("Non-refundable");
  });

  it("defaults rooms_required to 1 when InnPilot omits it", () => {
    const result = transformQuote({});
    expect(result.rooms_required).toBe(1);
  });

  it("passes through InnPilot occupancy fields and rooms_required", () => {
    const parsed = {
      rooms_required: 2,
      max_adults: 3,
      max_children: 2,
      max_occupancy: 5,
    };

    const result = transformQuote(parsed);

    expect(result.rooms_required).toBe(2);
    expect(result.max_adults).toBe(3);
    expect(result.max_children).toBe(2);
    expect(result.max_occupancy).toBe(5);
  });

  it("forwards the InnPilot per-room allocation verbatim", () => {
    const result = transformQuote({
      rooms_required: 2,
      allocation: [
        { adults: 2, children: 1 },
        { adults: 2, children: 1 },
      ],
    });

    expect(result.allocation).toEqual([
      { adults: 2, children: 1 },
      { adults: 2, children: 1 },
    ]);
  });

  it("defaults allocation to null when InnPilot omits it", () => {
    const result = transformQuote({ rooms_required: 1 });
    expect(result.allocation).toBeNull();
  });

  it("passes through the cancellation policy description verbatim", () => {
    const result = transformQuote({
      cancellation_policy: { description: "Free cancellation up to 48 hours before check-in" },
    });
    expect(result.cancellation_policy).toBe(
      "Free cancellation up to 48 hours before check-in"
    );
  });
});
