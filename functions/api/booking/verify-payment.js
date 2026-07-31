const INNPILOT_TIMEOUT_MS = 15000;
const rateLimitMap = new Map();

import { unwrapInnPilotData } from "./_response-envelope.js";

export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const windowMs = 60000;
  const maxReqs = 10;
  const entry = rateLimitMap.get(ip);
  if (entry) {
    const recent = entry.filter((t) => now - t < windowMs);
    if (recent.length >= maxReqs) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Try again later." }),
        { status: 429, headers }
      );
    }
    recent.push(now);
    rateLimitMap.set(ip, recent);
  } else {
    rateLimitMap.set(ip, [now]);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers }
    );
  }

  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
  } = body || {};

  if (!razorpay_order_id) {
    return new Response(
      JSON.stringify({ error: "razorpay_order_id is required" }),
      { status: 400, headers }
    );
  }

  const apiKey = env.BOOKING_API_KEY;
  if (!apiKey) {
    console.error("BOOKING_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "Booking service not configured" }),
      { status: 500, headers }
    );
  }

  const base = env.INNPILOT_BASE_URL || "https://app.inn-pilot.com";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), INNPILOT_TIMEOUT_MS);

  try {
    const payload = {
      razorpay_order_id,
    };
    if (razorpay_payment_id) payload.razorpay_payment_id = razorpay_payment_id;
    if (razorpay_signature) payload.razorpay_signature = razorpay_signature;

    const res = await fetch(`${base}/api/public/verify-payment`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseBody = await res.text();

    if (!res.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseBody);
      } catch {
        errorData = { error: "Payment verification failed" };
      }
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: errorData.error?.message || errorData.error || "Payment verification failed",
        }),
        { status: 502, headers }
      );
    }

    let data;
    try {
      data = JSON.parse(responseBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid response from payment service" }),
        { status: 502, headers }
      );
    }

    const innpilotData = unwrapInnPilotData(data);

    return new Response(
      JSON.stringify({
        success: true,
        verified: innpilotData.verified === true,
        booking_id: innpilotData.reservation_id || null,
        payment_id: razorpay_payment_id || innpilotData.payment_id || null,
        status: innpilotData.status || "unknown",
        signature_verified: innpilotData.signature_verified,
        booking: innpilotData,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    clearTimeout(timeoutId);

    if (err?.name === "AbortError" || err?.code === "ABORT_ERR") {
      return new Response(
        JSON.stringify({
          error: "Payment verification timed out. Please contact support.",
        }),
        { status: 504, headers }
      );
    }

    console.error("Payment verification error:", err);
    return new Response(
      JSON.stringify({ error: "Payment verification temporarily unavailable" }),
      { status: 502, headers }
    );
  }
}
