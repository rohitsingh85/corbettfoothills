import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SESSION_DURATION_MS,
  SESSION_WARNING_THRESHOLD_MS,
  SESSION_URGENT_THRESHOLD_MS,
  SESSION_STORAGE_KEY,
} from "../types/booking-session";
import type { BookingSession, PaymentMethod, BookingStep } from "../types/booking-session";

describe("booking-session types", () => {
  it("SESSION_DURATION_MS is 5 minutes", () => {
    expect(SESSION_DURATION_MS).toBe(300_000);
  });

  it("SESSION_WARNING_THRESHOLD_MS is 2 minutes", () => {
    expect(SESSION_WARNING_THRESHOLD_MS).toBe(120_000);
  });

  it("SESSION_URGENT_THRESHOLD_MS is 1 minute", () => {
    expect(SESSION_URGENT_THRESHOLD_MS).toBe(60_000);
  });

  it("SESSION_STORAGE_KEY is defined", () => {
    expect(SESSION_STORAGE_KEY).toBe("cfr_booking_session");
  });
});

describe("BookingSession shape", () => {
  function createTestSession(overrides: Partial<BookingSession> = {}): BookingSession {
    const now = Date.now();
    return {
      sessionId: "test-session-123",
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
        cancellationPolicy: "Free cancellation up to 48 hours",
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

  it("has all required fields", () => {
    const session = createTestSession();
    expect(session.sessionId).toBeTruthy();
    expect(session.createdAt).toBeGreaterThan(0);
    expect(session.expiresAt).toBeGreaterThan(session.createdAt);
    expect(session.roomSlug).toBeTruthy();
    expect(session.checkin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(session.checkout).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(session.adults).toBeGreaterThanOrEqual(1);
    expect(session.guest.firstName).toBeTruthy();
    expect(session.guest.email).toContain("@");
    expect(session.quote.grandTotal).toBeGreaterThan(0);
  });

  it("supports valid payment methods", () => {
    const methods: PaymentMethod[] = ["upi-qr", "upi-app", "pay-at-checkin"];
    methods.forEach((method) => {
      const session = createTestSession({ paymentMethod: method });
      expect(session.paymentMethod).toBe(method);
    });
  });

  it("supports valid booking steps", () => {
    const steps: BookingStep[] = [
      "search", "results", "guests", "review", "payment",
      "payment-qr", "payment-upi", "payment-checkin",
      "session-expired", "booking-confirmed", "booking-error",
    ];
    steps.forEach((step) => {
      const session = createTestSession({ currentStep: step });
      expect(session.currentStep).toBe(step);
    });
  });

  it("supports valid payment statuses", () => {
    const statuses = ["pending", "method-selected", "processing", "completed", "failed", "expired"];
    statuses.forEach((status) => {
      const session = createTestSession({ paymentStatus: status as BookingSession["paymentStatus"] });
      expect(session.paymentStatus).toBe(status);
    });
  });

  it("session expires after 5 minutes", () => {
    const session = createTestSession();
    const duration = session.expiresAt - session.createdAt;
    expect(duration).toBe(SESSION_DURATION_MS);
  });
});
