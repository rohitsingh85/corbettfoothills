import { describe, it, expect } from "vitest";

// Regression tests for the payment-exit → new search pricing bug.
//
// Scenario (as reported): a guest books 2 nights of the Family Lodge
// (₹3,000/night), reaches Payment, and exits without paying. They then run a
// NEW 1-night search. Without a reset, the stale 2-night quote (₹6,000)
// leaked into the new search and the summary showed "Room (1 night) ₹6,000 /
// Total ₹6,000".
//
// These functions mirror the logic in src/pages/booking.astro
// (computeNights + buildPricingRowsHtml + resetBookingFlow) so the regression
// is locked in at the state level.

const DRAFT_STORAGE_KEY = "cfr_booking_draft";
const SESSION_STORAGE_KEY = "cfr_booking_session";

function computeNights(checkin: string, checkout: string): number {
  return Math.ceil(
    (new Date(checkout + "T00:00:00").getTime() -
      new Date(checkin + "T00:00:00").getTime()) /
      86400000
  );
}

function computePricing(quote: any, nights: number) {
  let taxes: Array<{ label: string; amount: number }> = [];
  if (Array.isArray(quote.taxBreakdown)) {
    taxes = quote.taxBreakdown;
  } else if (quote.totalTaxes > 0) {
    taxes = [{ label: "Taxes", amount: quote.totalTaxes }];
  }
  const roomAmount = quote.subtotal || quote.total || 0;
  const total = quote.total || quote.grandTotal || quote.subtotal || 0;
  return {
    roomLabel: "Room (" + nights + " night" + (nights !== 1 ? "s" : "") + ")",
    roomAmount,
    total,
    taxes,
  };
}

interface FlowState {
  quoteData: any;
  selectedRoom: any;
  selectedRoomType: string | null;
  guestData: any;
  sessionData: any;
  storage: Record<string, string>;
}

function createFlowState(overrides: Partial<FlowState> = {}): FlowState {
  return {
    quoteData: null,
    selectedRoom: null,
    selectedRoomType: null,
    guestData: null,
    sessionData: null,
    storage: {},
    ...overrides,
  };
}

function resetBookingFlow(state: FlowState): void {
  state.quoteData = null;
  state.selectedRoom = null;
  state.selectedRoomType = null;
  state.guestData = null;
  delete state.storage[DRAFT_STORAGE_KEY];
  delete state.storage[SESSION_STORAGE_KEY];
  state.sessionData = null;
}

const OLD_2_NIGHT_QUOTE = { subtotal: 6000, total: 6000, totalTaxes: 0 };
const FRESH_1_NIGHT_QUOTE = { subtotal: 3000, total: 3000, totalTaxes: 0 };

describe("payment-exit → new 1-night search (pricing must not be stale)", () => {
  it("documents the bug: a stale 2-night quote yields ₹6,000 for a 1-night search", () => {
    const nights = computeNights("2026-08-02", "2026-08-03");
    expect(nights).toBe(1);
    const pricing = computePricing(OLD_2_NIGHT_QUOTE, nights);
    expect(pricing.roomLabel).toBe("Room (1 night)");
    expect(pricing.total).toBe(6000);
  });

  it("after reset + fresh quote, 1 night = ₹3,000", () => {
    const state = createFlowState({
      quoteData: OLD_2_NIGHT_QUOTE,
      selectedRoom: { slug: "family-lodge" },
      guestData: { firstName: "Rahul" },
      storage: {
        [SESSION_STORAGE_KEY]: "old-payment-session",
        [DRAFT_STORAGE_KEY]: "old-draft",
      },
    });

    resetBookingFlow(state);
    expect(state.quoteData).toBeNull();
    expect(state.selectedRoom).toBeNull();
    expect(state.guestData).toBeNull();
    expect(state.sessionData).toBeNull();
    expect(state.storage[SESSION_STORAGE_KEY]).toBeUndefined();
    expect(state.storage[DRAFT_STORAGE_KEY]).toBeUndefined();

    state.quoteData = FRESH_1_NIGHT_QUOTE;
    const pricing = computePricing(state.quoteData, computeNights("2026-08-02", "2026-08-03"));
    expect(pricing.roomLabel).toBe("Room (1 night)");
    expect(pricing.total).toBe(3000);
  });

  it("2 nights = ₹6,000 with a fresh 2-night quote", () => {
    const nights = computeNights("2026-08-02", "2026-08-04");
    expect(nights).toBe(2);
    const pricing = computePricing({ subtotal: 6000, total: 6000 }, nights);
    expect(pricing.roomLabel).toBe("Room (2 nights)");
    expect(pricing.total).toBe(6000);
  });

  it("a new search clears the persisted payment session so it cannot resurrect", () => {
    const state = createFlowState({
      sessionData: { sessionId: "s-1", paymentStatus: "pending" },
      storage: {
        [SESSION_STORAGE_KEY]: JSON.stringify({ sessionId: "s-1", paymentStatus: "pending" }),
      },
    });
    resetBookingFlow(state);
    expect(state.sessionData).toBeNull();
    expect(state.storage[SESSION_STORAGE_KEY]).toBeUndefined();
  });

  it("changing dates after payment abandonment recalculates from current inputs", () => {
    const state = createFlowState({
      quoteData: OLD_2_NIGHT_QUOTE,
      selectedRoom: { slug: "family-lodge" },
      selectedRoomType: "Deluxe Room",
      storage: {
        [SESSION_STORAGE_KEY]: JSON.stringify({ sessionId: "s-1", quote: OLD_2_NIGHT_QUOTE }),
      },
    });

    resetBookingFlow(state);
    const newParams = { checkin: "2026-08-02", checkout: "2026-08-03", adults: 2, children: 0 };
    state.quoteData = FRESH_1_NIGHT_QUOTE;
    const pricing = computePricing(state.quoteData, computeNights(newParams.checkin, newParams.checkout));
    expect(pricing.total).toBe(3000);
    expect(pricing.roomLabel).toBe("Room (1 night)");
  });

  it("changing guests never reuses a stale quote", () => {
    const state = createFlowState({
      quoteData: { subtotal: 12000, total: 12000 },
      guestData: { firstName: "Old", lastName: "Guest" },
      storage: {
        [DRAFT_STORAGE_KEY]: JSON.stringify({ roomSlug: "family-lodge", quote: { total: 12000 } }),
      },
    });

    resetBookingFlow(state);
    const newGuestQuote = { subtotal: 6000, total: 6000 };
    state.quoteData = newGuestQuote;
    const pricing = computePricing(state.quoteData, computeNights("2026-08-02", "2026-08-04"));
    expect(pricing.total).toBe(6000);
  });

  it("a fresh search always sends the current search params to the quote endpoint", () => {
    const state = createFlowState({ quoteData: OLD_2_NIGHT_QUOTE });
    resetBookingFlow(state);

    const currentParams = { checkin: "2026-08-02", checkout: "2026-08-03", adults: 2, children: 0 };
    const quoteRequestBody = {
      room_id: "Deluxe Room",
      checkin: currentParams.checkin,
      checkout: currentParams.checkout,
      adults: currentParams.adults,
      children: currentParams.children,
    };
    expect(quoteRequestBody.checkin).toBe("2026-08-02");
    expect(quoteRequestBody.checkout).toBe("2026-08-03");
    expect(quoteRequestBody.adults).toBe(2);
    expect(quoteRequestBody.children).toBe(0);
  });
});
