import { describe, it, expect } from "vitest";

// Regression tests for the same-date close bug in the booking calendar.
//
// Scenario (as reported): on a fresh load or a URL-restored "results" step,
// the checkout picker had no minimum and a checkout date on or before
// check-in slipped straight through to availability, so a guest could not
// select a valid two-day stay and the search returned empty/odd results.
//
// These functions mirror the logic in src/pages/booking.astro
// (setDefaultDates + syncCheckoutRange + the checkin/checkout "change"
// handlers + the restoreStepFromUrl "results" branch) so the regression is
// locked in at the state level.

function formatDateValue(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return formatDateValue(d);
}

// Mirrors syncCheckoutRange(): re-anchors the checkout lower bound to the day
// after check-in and corrects a checkout that is on or before check-in.
function syncCheckoutRange(checkin, checkout) {
  if (!checkin) return null;
  const nextDay = addDays(checkin, 1);
  if (checkout && checkout <= checkin) {
    checkout = nextDay;
  }
  return { checkout, min: nextDay };
}

// Mirrors setDefaultDates(): checkin = today+1, checkout = today+2, then
// syncCheckoutRange() anchors the checkout bound.
function setDefaultDates(now = new Date()) {
  const todayStr = formatDateValue(now);
  const checkin = addDays(todayStr, 1);
  const checkout = addDays(todayStr, 2);
  const synced = syncCheckoutRange(checkin, checkout);
  return {
    checkin,
    checkout: synced.checkout,
    checkinMin: todayStr,
    checkoutMin: synced.min,
  };
}

// Mirrors the restoreStepFromUrl "results" branch: set values, then sync
// BEFORE triggering the availability search.
function restoreResultsStep(params) {
  const synced = syncCheckoutRange(params.checkin, params.checkout);
  return {
    checkin: params.checkin,
    checkout: synced.checkout,
    checkoutMin: synced.min,
  };
}

// Mirrors the checkin input "change" handler.
function onCheckinChanged(checkin, checkout) {
  return syncCheckoutRange(checkin, checkout);
}

// Mirrors the checkout input "change" handler.
function onCheckoutChanged(checkin, checkout) {
  if (!checkout || !checkin) return null;
  if (checkout > checkin) {
    return { checkout, min: addDays(checkin, 1), changed: false };
  }
  const synced = syncCheckoutRange(checkin, checkout);
  return { checkout: synced.checkout, min: synced.min, changed: true };
}

describe("setDefaultDates (fresh load)", () => {
  const now = new Date("2026-08-28T10:00:00");

  it("sets checkin/today+1 and checkout/today+2", () => {
    const d = setDefaultDates(now);
    expect(d.checkin).toBe("2026-08-29");
    expect(d.checkout).toBe("2026-08-30");
    expect(d.checkinMin).toBe("2026-08-28");
  });

  it("anchors the checkout picker minimum to the day after check-in (the bug: it was unset on fresh load)", () => {
    const d = setDefaultDates(now);
    expect(d.checkoutMin).toBe("2026-08-30");
  });
});

describe("syncCheckoutRange (same-date / back-dated rule)", () => {
  it("corrects a same-date checkout to the day after check-in", () => {
    const r = syncCheckoutRange("2026-08-29", "2026-08-29");
    expect(r).toEqual({ checkout: "2026-08-30", min: "2026-08-30" });
  });

  it("corrects a back-dated checkout to the day after check-in", () => {
    const r = syncCheckoutRange("2026-08-29", "2026-08-28");
    expect(r).toEqual({ checkout: "2026-08-30", min: "2026-08-30" });
  });

  it("leaves a valid checkout on or after check-in+1 untouched", () => {
    expect(syncCheckoutRange("2026-08-29", "2026-08-30")).toEqual({
      checkout: "2026-08-30",
      min: "2026-08-30",
    });
    expect(syncCheckoutRange("2026-08-29", "2026-08-31")).toEqual({
      checkout: "2026-08-31",
      min: "2026-08-30",
    });
  });

  it("rolls across month/year boundaries", () => {
    const r = syncCheckoutRange("2026-12-31", "2026-12-31");
    expect(r).toEqual({ checkout: "2027-01-01", min: "2027-01-01" });
  });

  it("no-ops when check-in is empty", () => {
    expect(syncCheckoutRange("", "2026-08-30")).toBeNull();
  });
});

describe("URL restore (results step)", () => {
  it("normalizes checkin == checkout to checkin+1 BEFORE the search", () => {
    // The bug: values were set as-is and searchAvailability() ran with the
    // invalid same-date range. Now syncCheckoutRange() runs first.
    const r = restoreResultsStep({ checkin: "2026-08-29", checkout: "2026-08-29" });
    expect(r.checkout).toBe("2026-08-30");
    expect(r.checkoutMin).toBe("2026-08-30");
  });

  it("preserves a valid restored range", () => {
    const r = restoreResultsStep({ checkin: "2026-08-29", checkout: "2026-09-01" });
    expect(r.checkout).toBe("2026-09-01");
    expect(r.checkoutMin).toBe("2026-08-30");
  });
});

describe("checkin/checkout change handlers", () => {
  it("moving check-in past a stale checkout re-anchors checkout + bound", () => {
    const r = onCheckinChanged("2026-09-05", "2026-08-30");
    expect(r).toEqual({ checkout: "2026-09-06", min: "2026-09-06" });
  });

  it("a valid post-change checkout is preserved", () => {
    const r = onCheckinChanged("2026-08-29", "2026-08-30");
    expect(r).toEqual({ checkout: "2026-08-30", min: "2026-08-30" });
  });

  it("checkout handler corrects same-date input instead of ignoring it", () => {
    const r = onCheckoutChanged("2026-08-29", "2026-08-29");
    expect(r).toEqual({ checkout: "2026-08-30", min: "2026-08-30", changed: true });
  });

  it("checkout handler leaves a valid input untouched", () => {
    const r = onCheckoutChanged("2026-08-29", "2026-08-31");
    expect(r).toEqual({ checkout: "2026-08-31", min: "2026-08-30", changed: false });
  });
});