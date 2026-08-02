import { describe, it, expect, afterEach } from "vitest";
import * as submitBFF from "../../functions/api/booking/submit.js";
import * as quoteBFF from "../../functions/api/booking/quote.js";
import * as verifyBFF from "../../functions/api/booking/verify-payment.js";

// The CFR BFFs are a thin relay: they build the InnPilot payload from a fixed
// allowlist of fields and forward InnPilot's own totals back to the frontend.
// These tests prove a malicious client cannot smuggle financial/bedding values
// (amount, bedding_total, currency, allocation, chargePerNight, etc.) through
// the BFF to InnPilot — InnPilot remains the only authority on what is charged.
// Customer bedding *selections* ({ room_index, selected }) are the one
// client-derived value the BFF relays, and only after sanitizing them down to
// those two fields.

const ENV = { BOOKING_API_KEY: "test-key", INNPILOT_BASE_URL: "https://innpilot.test" };

let upstreamCalls: Array<{ url: string; body: unknown }> = [];
let ipCounter = 0;

function uniqueIp() {
  ipCounter += 1;
  return "192.0.2." + (ipCounter % 254 + 1);
}

function callBFF(bff: { onRequest: (ctx: { request: Request; env: typeof ENV }) => Promise<Response> }, body: Record<string, unknown>) {
  const request = new Request("https://cfr.test/api/booking", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": uniqueIp() },
    body: JSON.stringify(body),
  });
  return bff.onRequest({ request, env: ENV });
}

function captureFetch() {
  upstreamCalls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const rawBody = init && init.body ? String(init.body) : "";
    let body: unknown = null;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = null;
      }
    }
    upstreamCalls.push({ url, body });
    return new Response(JSON.stringify({ success: true, data: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

const SUBMIT_ALLOWLIST = [
  "room_type",
  "check_in",
  "check_out",
  "adults",
  "children",
  "first_name",
  "last_name",
  "email",
  "phone",
  "special_requests",
  "source",
  "rooms_required",
];

const QUOTE_ALLOWLIST = [
  "room_type",
  "check_in",
  "check_out",
  "adults",
  "children",
  "rooms_required",
];

const VERIFY_ALLOWLIST = ["razorpay_order_id", "razorpay_payment_id", "razorpay_signature"];

afterEach(() => {
  globalThis.fetch = undefined as unknown as typeof fetch;
});

describe("BFF financial/bedding allowlist (client-manipulation safety)", () => {
  it("submit.js drops injected financial/bedding fields and forwards only the allowlist", async () => {
    captureFetch();
    const res = await callBFF(submitBFF, {
      room_id: "Deluxe Room",
      checkin: "2026-08-10",
      checkout: "2026-08-12",
      adults: 2,
      children: 1,
      rooms_required: 2,
      guest: {
        firstName: "Rohit",
        lastName: "Singh",
        email: "rohit@example.com",
        phone: "+919000000000",
        specialRequests: "Please prepare extra bedding for room 2",
      },
      quote_id: "Q-INJECTED",
      amount: 1,
      bedding_total: 999,
      total_amount: 0,
      currency: "USD",
      deposit_required: 0,
      allocation: [{ adults: 2, children: 1 }],
      bedding: { chargePerNight: 1 },
    });

    expect(res.status).toBe(200);
    expect(upstreamCalls).toHaveLength(1);
    expect(upstreamCalls[0].url).toContain("/api/public/book");

    const forwarded = upstreamCalls[0].body as Record<string, unknown>;
    expect(Object.keys(forwarded).sort()).toEqual([...SUBMIT_ALLOWLIST].sort());
    expect(forwarded.amount).toBeUndefined();
    expect(forwarded.bedding_total).toBeUndefined();
    expect(forwarded.total_amount).toBeUndefined();
    expect(forwarded.currency).toBeUndefined();
    expect(forwarded.allocation).toBeUndefined();
    expect(forwarded.bedding).toBeUndefined();
    expect(forwarded.rooms_required).toBe(2);
    expect(forwarded.special_requests).toBe("Please prepare extra bedding for room 2");
  });

  it("quote.js drops injected financial/bedding fields and forwards only the allowlist", async () => {
    captureFetch();
    const res = await callBFF(quoteBFF, {
      room_id: "Deluxe Room",
      checkin: "2026-08-10",
      checkout: "2026-08-12",
      adults: 2,
      children: 1,
      rooms_required: 1,
      amount: 1,
      bedding_total: 999,
      total_amount: 0,
      currency: "USD",
      allocation_options: [{ rooms: [{ adults: 2, children: 1 }], total: 1 }],
      bedding: { chargePerNight: 1 },
    });

    expect(res.status).toBe(200);
    expect(upstreamCalls).toHaveLength(1);
    expect(upstreamCalls[0].url).toContain("/api/public/quote");

    const forwarded = upstreamCalls[0].body as Record<string, unknown>;
    expect(Object.keys(forwarded).sort()).toEqual([...QUOTE_ALLOWLIST].sort());
    expect(forwarded.amount).toBeUndefined();
    expect(forwarded.bedding_total).toBeUndefined();
    expect(forwarded.currency).toBeUndefined();
    expect(forwarded.allocation_options).toBeUndefined();
    expect(forwarded.bedding).toBeUndefined();
    expect(forwarded.rooms_required).toBe(1);
  });

  it("verify-payment.js forwards only razorpay identifiers", async () => {
    captureFetch();
    const res = await callBFF(verifyBFF, {
      razorpay_payment_id: "pay_123",
      razorpay_order_id: "ord_123",
      razorpay_signature: "sig_123",
      amount: 1,
      currency: "USD",
    });

    expect(res.status).toBe(200);
    expect(upstreamCalls).toHaveLength(1);
    expect(upstreamCalls[0].url).toContain("/api/public/verify-payment");

    const forwarded = upstreamCalls[0].body as Record<string, unknown>;
    expect(Object.keys(forwarded).sort()).toEqual([...VERIFY_ALLOWLIST].sort());
    expect(forwarded.amount).toBeUndefined();
    expect(forwarded.currency).toBeUndefined();
  });

  it("submit.js forwards only sanitized bedding selections ({room_index, selected})", async () => {
    captureFetch();
    const res = await callBFF(submitBFF, {
      room_id: "Deluxe Room",
      checkin: "2026-08-10",
      checkout: "2026-08-12",
      adults: 2,
      children: 1,
      rooms_required: 1,
      guest: {
        firstName: "Rohit",
        lastName: "Singh",
        email: "rohit@example.com",
        phone: "+919000000000",
      },
      bedding: [
        { room_index: 0, selected: true, chargePerNight: 999999, bedding_total: 777777 },
        { room_index: 1, selected: false },
        { room_index: "2", selected: 1, amount: 0 },
        { room_index: 99, selected: true },
        { room_index: -1, selected: true },
        "garbage",
        { chargePerNight: 5 },
      ],
    });

    expect(res.status).toBe(200);
    expect(upstreamCalls).toHaveLength(1);

    const forwarded = upstreamCalls[0].body as Record<string, unknown>;
    // `toEqual` is an exact-match: the sanitizer's output has only these two
    // keys, which also proves injected chargePerNight/bedding_total are gone.
    expect(forwarded.bedding).toEqual([
      { room_index: 0, selected: true },
      { room_index: 1, selected: false },
      { room_index: 2, selected: true },
    ]);
    expect(forwarded.chargePerNight).toBeUndefined();
    expect(forwarded.bedding_total).toBeUndefined();
  });

  it("quote.js forwards sanitized bedding selections", async () => {
    captureFetch();
    const res = await callBFF(quoteBFF, {
      room_id: "Deluxe Room",
      checkin: "2026-08-10",
      checkout: "2026-08-12",
      adults: 2,
      children: 1,
      rooms_required: 1,
      bedding: [{ room_index: 0, selected: true, chargePerNight: 1, currency: "USD" }],
    });

    expect(res.status).toBe(200);
    expect(upstreamCalls).toHaveLength(1);

    const forwarded = upstreamCalls[0].body as Record<string, unknown>;
    expect(forwarded.bedding).toEqual([{ room_index: 0, selected: true }]);
  });

  it("a non-array bedding payload (malicious object) is dropped entirely", async () => {
    captureFetch();
    const res = await callBFF(quoteBFF, {
      room_id: "Deluxe Room",
      checkin: "2026-08-10",
      checkout: "2026-08-12",
      adults: 2,
      children: 1,
      rooms_required: 1,
      bedding: { room_index: 0, selected: true, chargePerNight: 1 },
    });

    expect(res.status).toBe(200);
    expect(upstreamCalls).toHaveLength(1);
    expect((upstreamCalls[0].body as Record<string, unknown>).bedding).toBeUndefined();
  });
});
