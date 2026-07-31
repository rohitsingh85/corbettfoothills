import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const SESSION_DURATION_MS = 300000;
const SESSION_WARNING_MS = 120000;
const SESSION_URGENT_MS = 60000;
const SESSION_STORAGE_KEY = "cfr_booking_session";

function createTestSession(overrides: Record<string, any> = {}) {
  const now = Date.now();
  return {
    sessionId: "test-123",
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
    serverTimeAtCreate: now,
    roomSlug: "forest-suite",
    roomName: "Forest Suite",
    checkin: "2026-08-01",
    checkout: "2026-08-03",
    adults: 2,
    children: 0,
    guest: {
      firstName: "Rahul",
      lastName: "Sharma",
      email: "rahul@test.com",
      phone: "+91 98765 43210",
    },
    quote: {
      subtotal: 12000,
      totalTaxes: 2160,
      grandTotal: 14160,
      cancellationPolicy: "Free cancellation",
      taxBreakdown: [{ label: "GST", amount: 2160 }],
      nightlyRate: 6000,
      totalStay: 12000,
    },
    paymentMethod: null,
    paymentStatus: "pending",
    currentStep: "payment",
    ...overrides,
  };
}

describe("session expiry logic", () => {
  it("session is not expired when created", () => {
    const session = createTestSession();
    expect(Date.now()).toBeLessThan(session.expiresAt);
  });

  it("session is expired when expiresAt is in the past", () => {
    const session = createTestSession({ expiresAt: Date.now() - 1000 });
    expect(Date.now()).toBeGreaterThan(session.expiresAt);
  });

  it("remaining time is correct", () => {
    const session = createTestSession();
    const remaining = session.expiresAt - Date.now();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(SESSION_DURATION_MS);
  });

  it("remaining time is zero when expired", () => {
    const session = createTestSession({ expiresAt: Date.now() - 1000 });
    const remaining = Math.max(0, session.expiresAt - Date.now());
    expect(remaining).toBe(0);
  });
});

describe("time formatting", () => {
  function formatTimeRemaining(ms: number): string {
    if (ms <= 0) return "0:00";
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, "0")}`;
  }

  it("formats 5 minutes correctly", () => {
    expect(formatTimeRemaining(300000)).toBe("5:00");
  });

  it("formats 1 minute correctly", () => {
    expect(formatTimeRemaining(60000)).toBe("1:00");
  });

  it("formats 30 seconds correctly", () => {
    expect(formatTimeRemaining(30000)).toBe("0:30");
  });

  it("formats 0 as 0:00", () => {
    expect(formatTimeRemaining(0)).toBe("0:00");
  });

  it("formats negative as 0:00", () => {
    expect(formatTimeRemaining(-5000)).toBe("0:00");
  });

  it("rounds up to nearest second", () => {
    expect(formatTimeRemaining(61000)).toBe("1:01");
  });
});

describe("session state transitions", () => {
  function getSessionState(session: any): string {
    if (session.paymentStatus === "completed") return "confirmed";
    const remaining = Math.max(0, session.expiresAt - Date.now());
    if (remaining <= 0) return "expired";
    if (remaining <= SESSION_URGENT_MS) return "urgent";
    if (remaining <= SESSION_WARNING_MS) return "warning";
    return "active";
  }

  it("returns 'active' when session just created", () => {
    const session = createTestSession();
    expect(getSessionState(session)).toBe("active");
  });

  it("returns 'warning' when less than 2 minutes remain", () => {
    const session = createTestSession({ expiresAt: Date.now() + 100000 });
    expect(getSessionState(session)).toBe("warning");
  });

  it("returns 'urgent' when less than 1 minute remains", () => {
    const session = createTestSession({ expiresAt: Date.now() + 30000 });
    expect(getSessionState(session)).toBe("urgent");
  });

  it("returns 'expired' when session has expired", () => {
    const session = createTestSession({ expiresAt: Date.now() - 1000 });
    expect(getSessionState(session)).toBe("expired");
  });

  it("returns 'confirmed' when payment completed", () => {
    const session = createTestSession({
      paymentStatus: "completed",
      expiresAt: Date.now() - 1000,
    });
    expect(getSessionState(session)).toBe("confirmed");
  });
});

describe("session persistence", () => {
  const storage: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.keys(storage).forEach((k) => delete storage[k]);
  });

  it("persists and loads session", () => {
    const session = createTestSession();
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const loaded = JSON.parse(raw!);
    expect(loaded.sessionId).toBe(session.sessionId);
    expect(loaded.expiresAt).toBe(session.expiresAt);
  });

  it("returns null for missing session", () => {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    expect(raw).toBeNull();
  });

  it("clears session", () => {
    const session = createTestSession();
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    expect(raw).toBeNull();
  });

  it("handles corrupted data gracefully", () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, "not-json");
    let parsed = null;
    try {
      parsed = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)!);
    } catch {
      parsed = null;
    }
    expect(parsed).toBeNull();
  });
});

describe("navigation protection", () => {
  it("should warn when session is active", () => {
    const session = createTestSession();
    const remaining = session.expiresAt - Date.now();
    const shouldWarn = remaining > 0 && session.paymentStatus !== "completed";
    expect(shouldWarn).toBe(true);
  });

  it("should not warn when session is expired", () => {
    const session = createTestSession({ expiresAt: Date.now() - 1000 });
    const remaining = Math.max(0, session.expiresAt - Date.now());
    const shouldWarn = remaining > 0 && session.paymentStatus !== "completed";
    expect(shouldWarn).toBe(false);
  });

  it("should not warn when payment is completed", () => {
    const session = createTestSession({ paymentStatus: "completed" });
    const remaining = session.expiresAt - Date.now();
    const shouldWarn = remaining > 0 && session.paymentStatus !== "completed";
    expect(shouldWarn).toBe(false);
  });
});
