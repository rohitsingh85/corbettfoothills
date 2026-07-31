const INNPILOT_TIMEOUT_MS = 15000;
const rateLimitMap = new Map();

import { unwrapInnPilotData } from "./_response-envelope.js";

// ---- Single canonical mapping: InnPilot room_type → ROOM_CONTENT slug ----
// availability.js is the sole owner of this mapping.  Changing it here updates
// every downstream caller (quote.js and submit.js receive the raw InnPilot
// room_type from the frontend, so they need no mapping at all).
const ROOM_TYPE_MAP = { "Deluxe Room": "forest-suite" };
// ---- end mapping ----

export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "GET") {
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
  const maxReqs = 20;
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

  const url = new URL(request.url);
  const checkin = url.searchParams.get("checkin") || "";
  const checkout = url.searchParams.get("checkout") || "";
  const adults = parseInt(url.searchParams.get("adults") || "0", 10);
  const children = parseInt(url.searchParams.get("children") || "0", 10);

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
  if (children < 0) {
    return new Response(
      JSON.stringify({ error: "Children count cannot be negative" }),
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

  const upstreamUrl = new URL(`${base}/api/public/availability`);
  upstreamUrl.searchParams.set("check_in", checkin);
  upstreamUrl.searchParams.set("check_out", checkout);
  upstreamUrl.searchParams.set("adults", String(adults));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), INNPILOT_TIMEOUT_MS);

  try {
    const res = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const body = await res.text();

    // Parse and transform InnPilot response to frontend contract.
    // InnPilot returns snake_case fields and "room_types"; frontend expects
    // camelCase fields and "rooms".  This mapping isolates the frontend from
    // future InnPilot schema changes.
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (_) {
      // Unparseable body – pass through as-is
      return new Response(body, {
        status: res.status,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (!res.ok || parsed.error) {
      // Forward errors unchanged
      return new Response(body, {
        status: res.status,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // InnPilot wraps successful responses as { success: true, data: {...} }.
    // Unwrap the envelope so the transform below reads the payload directly.
    parsed = unwrapInnPilotData(parsed);

    const cancellationPolicy =
      parsed.cancellation_policy?.name ||
      parsed.cancellation_policy?.description ||
      "";

    const rooms = (parsed.room_types || []).map(function (r) {
      return {
        // content slug (for ROOM_CONTENT lookup in booking.astro)
        slug: ROOM_TYPE_MAP[r.room_type] || r.room_type,
        // raw InnPilot room_type value (for quote/submit BFF "room_id" param)
        room_type: r.room_type,
        name: r.room_type,
        available: true,
        roomsLeft: r.available_count ?? 0,
        nightlyRate: r.nightly_rate ?? 0,
        totalStay: r.total_rate ?? 0,
        grandTotal: r.total_rate ?? 0,
        originalNightlyRate: null,
        originalTotal: null,
        taxBreakdown: [],
        totalTaxes: 0,
        cancellationPolicy: cancellationPolicy,
      };
    });

    return new Response(
      JSON.stringify({
        rooms: rooms,
        checkin: parsed.check_in,
        checkout: parsed.check_out,
      }),
      {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      }
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

    console.error("Availability proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Booking system temporarily unavailable" }),
      { status: 502, headers }
    );
  }
}
