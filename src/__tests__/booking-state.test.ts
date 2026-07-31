import { describe, it, expect } from "vitest";

// Mirrors the draft/session state-restore logic implemented in src/pages/booking.astro.
// Kept as standalone pure functions (same pattern as session-logic.test.ts) to lock in
// the refresh / back / forward behaviour of the booking flow.

const DRAFT_STORAGE_KEY = "cfr_booking_draft";

function loadDraft(storage: Record<string, string>): any {
  try {
    const raw = storage[DRAFT_STORAGE_KEY];
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.roomSlug || !parsed.checkin || !parsed.checkout) return null;
    return parsed;
  } catch {
    return null;
  }
}

function hydrateFromSource(source: any): any {
  if (!source) return null;
  return {
    roomSlug: source.roomSlug,
    roomType: source.roomType || null,
    checkin: source.checkin,
    checkout: source.checkout,
    adults: source.adults,
    children: source.children || 0,
    quote: source.quote || null,
    guest: source.guest || {},
  };
}

type RestoreResult =
  | { action: "show"; step: string }
  | { action: "search" }
  | { action: "fetchQuote"; room: string }
  | { action: "recover" }
  | { action: "none" };

function decideRestore(params: {
  step: string;
  draft: any;
  session: any;
  hasRoomsRendered: boolean;
}): RestoreResult {
  const step = params.step || "search";

  if (step === "expired") return { action: "show", step: "session-expired" };
  if (step === "search") return { action: "show", step: "initial" };

  if (step === "results") {
    if (params.hasRoomsRendered) return { action: "show", step: "results" };
    if (params.draft) return { action: "search" };
    return { action: "show", step: "initial" };
  }

  if (step === "guests" || step === "review") {
    if (params.draft) {
      const source = hydrateFromSource(params.draft);
      if (source) {
        const hasGuest = Boolean(
          source.guest && (source.guest.firstName || source.guest.email || source.guest.phone)
        );
        if (step === "review" && hasGuest) return { action: "show", step: "review" };
        return { action: "show", step: "guests" };
      }
    }
    if (params.session) {
      return step === "review" ? { action: "show", step: "review" } : { action: "show", step: "guests" };
    }
    return { action: "fetchQuote", room: params.draft?.roomSlug || "" };
  }

  if (step === "payment") {
    if (params.session) return { action: "recover" };
    return { action: "show", step: "initial" };
  }

  return { action: "none" };
}

function buildPricingRows(quote: any) {
  let taxes: Array<{ label: string; amount: number }> = [];
  if (Array.isArray(quote.taxBreakdown)) {
    taxes = quote.taxBreakdown;
  } else if (quote.totalTaxes > 0) {
    taxes = [{ label: "Taxes", amount: quote.totalTaxes }];
  }
  const grandTotal = quote.total || quote.grandTotal || quote.subtotal || 0;
  return { taxes, grandTotal };
}

const sampleDraft = {
  roomSlug: "family-lodge",
  roomType: "Family Room",
  checkin: "2026-08-01",
  checkout: "2026-08-03",
  adults: 2,
  children: 0,
  quote: { subtotal: 7000, total: 7000, totalTaxes: 840, cancellation_policy: "Free cancellation" },
  guest: { firstName: "Rahul", lastName: "Sharma", email: "rahul@test.com", phone: "+91 98765 43210" },
  step: "review",
};

const sampleSession = {
  sessionId: "s-1",
  expiresAt: Date.now() + 300000,
  roomSlug: "family-lodge",
  roomType: "Family Room",
  checkin: "2026-08-01",
  checkout: "2026-08-03",
  adults: 2,
  children: 0,
  quote: { subtotal: 7000, total: 7840, grandTotal: 7840, totalTaxes: 840 },
  guest: { firstName: "Rahul", lastName: "Sharma", email: "rahul@test.com", phone: "+91 98765 43210" },
  currentStep: "payment",
};

describe("booking draft", () => {
  it("loads a valid draft", () => {
    const storage: Record<string, string> = {};
    storage[DRAFT_STORAGE_KEY] = JSON.stringify(sampleDraft);
    const draft = loadDraft(storage);
    expect(draft.roomSlug).toBe("family-lodge");
    expect(draft.step).toBe("review");
  });

  it("returns null when no draft exists", () => {
    expect(loadDraft({})).toBeNull();
  });

  it("returns null for corrupted draft", () => {
    const storage: Record<string, string> = { [DRAFT_STORAGE_KEY]: "not-json" };
    expect(loadDraft(storage)).toBeNull();
  });

  it("returns null for incomplete draft (missing dates)", () => {
    const storage: Record<string, string> = {
      [DRAFT_STORAGE_KEY]: JSON.stringify({ roomSlug: "family-lodge" }),
    };
    expect(loadDraft(storage)).toBeNull();
  });
});

describe("hydrate from source", () => {
  it("hydrates from a draft", () => {
    const state = hydrateFromSource(sampleDraft);
    expect(state.roomSlug).toBe("family-lodge");
    expect(state.roomType).toBe("Family Room");
    expect(state.quote.subtotal).toBe(7000);
    expect(state.guest.firstName).toBe("Rahul");
  });

  it("hydrates from a booking session", () => {
    const state = hydrateFromSource(sampleSession);
    expect(state.roomSlug).toBe("family-lodge");
    expect(state.checkin).toBe("2026-08-01");
    expect(state.children).toBe(0);
  });

  it("returns null for empty source", () => {
    expect(hydrateFromSource(null)).toBeNull();
  });
});

describe("restore step decision", () => {
  it("shows initial for search step", () => {
    expect(decideRestore({ step: "search", draft: null, session: null, hasRoomsRendered: false })).toEqual({
      action: "show",
      step: "initial",
    });
  });

  it("shows session-expired for expired step", () => {
    expect(decideRestore({ step: "expired", draft: null, session: null, hasRoomsRendered: false })).toEqual({
      action: "show",
      step: "session-expired",
    });
  });

  it("shows rendered results when back/forward returns to results", () => {
    expect(decideRestore({ step: "results", draft: null, session: null, hasRoomsRendered: true })).toEqual({
      action: "show",
      step: "results",
    });
  });

  it("re-searches results on fresh load with draft dates", () => {
    expect(decideRestore({ step: "results", draft: sampleDraft, session: null, hasRoomsRendered: false })).toEqual({
      action: "search",
    });
  });

  it("restores guests from draft", () => {
    expect(decideRestore({ step: "guests", draft: sampleDraft, session: null, hasRoomsRendered: false })).toEqual({
      action: "show",
      step: "guests",
    });
  });

  it("restores review from draft when guest info exists", () => {
    expect(decideRestore({ step: "review", draft: sampleDraft, session: null, hasRoomsRendered: false })).toEqual({
      action: "show",
      step: "review",
    });
  });

  it("falls back to guests when review draft has no guest info", () => {
    const noGuest = { ...sampleDraft, guest: {} };
    expect(decideRestore({ step: "review", draft: noGuest, session: null, hasRoomsRendered: false })).toEqual({
      action: "show",
      step: "guests",
    });
  });

  it("restores review from a live session after draft is cleared", () => {
    expect(decideRestore({ step: "review", draft: null, session: sampleSession, hasRoomsRendered: false })).toEqual({
      action: "show",
      step: "review",
    });
  });

  it("recovers payment from a live session", () => {
    expect(decideRestore({ step: "payment", draft: null, session: sampleSession, hasRoomsRendered: false })).toEqual({
      action: "recover",
    });
  });

  it("shows initial when payment step has no live session", () => {
    expect(decideRestore({ step: "payment", draft: null, session: null, hasRoomsRendered: false })).toEqual({
      action: "show",
      step: "initial",
    });
  });
});

describe("pricing rows", () => {
  it("uses taxBreakdown when present", () => {
    const { taxes, grandTotal } = buildPricingRows({
      subtotal: 7000,
      total: 7840,
      taxBreakdown: [{ label: "GST 12%", amount: 840 }],
      totalTaxes: 840,
    });
    expect(taxes).toHaveLength(1);
    expect(taxes[0].label).toBe("GST 12%");
    expect(grandTotal).toBe(7840);
  });

  it("falls back to a single Taxes line from totalTaxes", () => {
    const { taxes } = buildPricingRows({ subtotal: 7000, total: 7840, totalTaxes: 840 });
    expect(taxes).toEqual([{ label: "Taxes", amount: 840 }]);
  });

  it("falls back to grandTotal for sessions without a total", () => {
    const { grandTotal } = buildPricingRows({ subtotal: 7000, grandTotal: 7840, totalTaxes: 840 });
    expect(grandTotal).toBe(7840);
  });

  it("falls back to subtotal when no total exists", () => {
    const { grandTotal } = buildPricingRows({ subtotal: 7000 });
    expect(grandTotal).toBe(7000);
  });
});
