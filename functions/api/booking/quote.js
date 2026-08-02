const INNPILOT_TIMEOUT_MS = 15000;
const rateLimitMap = new Map();

import { unwrapInnPilotData } from "./_response-envelope.js";
import { transformQuote } from "./_quote-transform.js";
import { sanitizeBeddingSelections } from "./_bedding.js";

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
  const maxReqs = 30;
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
    rate_plan_id,
    checkin,
    checkout,
    adults,
    children,
    rooms_required,
    packages,
    bedding,
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

  if (children !== undefined && children < 0) {
    return new Response(
      JSON.stringify({ error: "Children count cannot be negative" }),
      { status: 400, headers }
    );
  }

  if (rooms_required !== undefined && rooms_required < 1) {
    return new Response(
      JSON.stringify({ error: "Rooms count cannot be less than 1" }),
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

  const quotePayload = {
    room_type: room_id,
    check_in: checkin,
    check_out: checkout,
    adults: Number(adults),
    children: Number(children || 0),
    rate_plan_id: rate_plan_id || undefined,
  };

  // The customer's requested room count (if any) is relayed to InnPilot so its
  // quote prices exactly that many rooms; InnPilot is authoritative.
  if (rooms_required && rooms_required >= 1) {
    quotePayload.rooms_required = Number(rooms_required);
  }

  if (rate_plan_id) {
    quotePayload.rate_plan_id = rate_plan_id;
  }

  if (packages && Array.isArray(packages) && packages.length > 0) {
    quotePayload.packages = packages;
  }

  // Relay only the customer's bedding selections (room_index + selected).
  // Any injected financial values are stripped by the sanitizer.
  const beddingSelections = sanitizeBeddingSelections(bedding);
  if (beddingSelections !== undefined) {
    quotePayload.bedding = beddingSelections;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), INNPILOT_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/api/public/quote`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(quotePayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseBody = await res.text();

    if (!res.ok) {
      // pass through errors unchanged
      return new Response(responseBody, {
        status: res.status,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Transform response: InnPilot uses snake_case; frontend expects camelCase
    let parsed;
    try {
      parsed = JSON.parse(responseBody);
    } catch {
      return new Response(responseBody, {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // InnPilot wraps successful responses as { success: true, data: {...} }.
    // Unwrap the envelope so the transform below reads the payload directly.
    parsed = unwrapInnPilotData(parsed);

    const transformed = transformQuote(parsed);

    // InnPilot is the source of truth for occupancy: it computes how many rooms
    // the party requires and already scales the totals.  CFR only relays it.
    const roomsRequired = transformed.rooms_required || 1;

    const responsePayload = Object.assign({}, transformed, {
      room_count: roomsRequired,
      rooms_required: roomsRequired,
      occupancy: {
        maxAdults: transformed.max_adults ?? null,
        maxChildren: transformed.max_children ?? null,
        maxOccupancy: transformed.max_occupancy ?? null,
        roomsRequired,
      },
    });

    return new Response(JSON.stringify(responsePayload), {
      status: res.status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
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

    console.error("Quote proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Booking system temporarily unavailable" }),
      { status: 502, headers }
    );
  }
}
