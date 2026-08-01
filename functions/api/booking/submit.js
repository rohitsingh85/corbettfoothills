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
    room_id,
    checkin,
    checkout,
    adults,
    children,
    rooms_required,
    guest,
    quote_id,
  } = body || {};

  if (!room_id || typeof room_id !== "string") {
    return new Response(
      JSON.stringify({ error: "room_id is required" }),
      { status: 400, headers }
    );
  }

  if (!checkin || !/^\d{4}-\d{2}-\d{2}$/.test(checkin)) {
    return new Response(
      JSON.stringify({ error: "Valid check-in date required (YYYY-MM-DD)" }),
      { status: 400, headers }
    );
  }

  if (!checkout || !/^\d{4}-\d{2}-\d{2}$/.test(checkout)) {
    return new Response(
      JSON.stringify({ error: "Valid check-out date required (YYYY-MM-DD)" }),
      { status: 400, headers }
    );
  }

  if (checkout <= checkin) {
    return new Response(
      JSON.stringify({ error: "Check-out must be after check-in" }),
      { status: 400, headers }
    );
  }

  if (!adults || adults < 1) {
    return new Response(
      JSON.stringify({ error: "At least 1 adult required" }),
      { status: 400, headers }
    );
  }

  if (!guest || typeof guest !== "object") {
    return new Response(
      JSON.stringify({ error: "Guest details are required" }),
      { status: 400, headers }
    );
  }

  if (!guest.firstName || !guest.lastName || !guest.email || !guest.phone) {
    return new Response(
      JSON.stringify({
        error: "Guest first name, last name, email, and phone are required",
      }),
      { status: 400, headers }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(guest.email)) {
    return new Response(
      JSON.stringify({ error: "Invalid email format" }),
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

  // InnPilot decides occupancy: it validates the party against the room type's
  // occupancy limits, prices the required number of rooms, and persists
  // total_rooms.  CFR relays the computed rooms_required (if any).
  const bookingPayload = {
    room_type: room_id,
    check_in: checkin,
    check_out: checkout,
    adults: Number(adults),
    children: Number(children || 0),
    first_name: guest.firstName,
    last_name: guest.lastName,
    email: guest.email,
    phone: guest.phone,
    special_requests: guest.specialRequests || "",
    source: "website",
  };

  if (rooms_required && rooms_required >= 1) {
    bookingPayload.rooms_required = Number(rooms_required);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), INNPILOT_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/api/public/book`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(bookingPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseBody = await res.text();

    if (!res.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseBody);
      } catch {
        errorData = { error: "Booking creation failed" };
      }
      const errorMessage =
        typeof errorData.error === "string"
          ? errorData.error
          : errorData.error?.message || "Booking creation failed";
      const errorDetails = errorData.error?.details?.errors;
      return new Response(
        JSON.stringify(
          errorDetails
            ? { success: false, error: errorMessage, details: errorDetails }
            : { success: false, error: errorMessage }
        ),
        { status: res.status >= 500 ? 502 : 400, headers }
      );
    }

    let data;
    try {
      data = JSON.parse(responseBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid response from booking service" }),
        { status: 502, headers }
      );
    }

    const innpilotData = unwrapInnPilotData(data);

    return new Response(
      JSON.stringify({
        success: true,
        booking_id: innpilotData.reservation_id,
        razorpay_order_id: innpilotData.razorpay_order_id,
        razorpay_key_id: innpilotData.razorpay_key_id,
        amount: innpilotData.amount,
        currency: innpilotData.currency || "INR",
        booking: innpilotData,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    clearTimeout(timeoutId);

    if (err?.name === "AbortError" || err?.code === "ABORT_ERR") {
      return new Response(
        JSON.stringify({
          error: "Booking system timed out. Please try again.",
        }),
        { status: 504, headers }
      );
    }

    console.error("Booking creation error:", err);
    return new Response(
      JSON.stringify({ error: "Booking system temporarily unavailable" }),
      { status: 502, headers }
    );
  }
}
