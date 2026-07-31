const INNPILOT_TIMEOUT_MS = 15000;
const rateLimitMap = new Map();

import { unwrapInnPilotData } from "./_response-envelope.js";
import { transformQuote } from "./_quote-transform.js";

export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
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

  if (request.method === "GET") {
    return new Response(
      JSON.stringify({
        serverTime: Date.now(),
        ok: true,
      }),
      { status: 200, headers }
    );
  }

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers }
      );
    }

    const { action, session_token, room_id, checkin, checkout, adults, children, quote_id } = body || {};

    if (!action || typeof action !== "string") {
      return new Response(
        JSON.stringify({ error: "action is required" }),
        { status: 400, headers }
      );
    }

    if (action === "validate") {
      if (!session_token || typeof session_token !== "object") {
        return new Response(
          JSON.stringify({ error: "session_token is required" }),
          { status: 400, headers }
        );
      }

      const { sessionId, expiresAt, sig } = session_token;
      if (!sessionId || !expiresAt || !sig) {
        return new Response(
          JSON.stringify({ error: "Invalid session token" }),
          { status: 400, headers }
        );
      }

      if (Date.now() > expiresAt) {
        return new Response(
          JSON.stringify({ valid: false, reason: "expired" }),
          { status: 200, headers }
        );
      }

      return new Response(
        JSON.stringify({
          valid: true,
          sessionId,
          expiresAt,
          serverTime: Date.now(),
        }),
        { status: 200, headers }
      );
    }

    if (action === "create") {
      if (!room_id || !checkin || !checkout || !adults) {
        return new Response(
          JSON.stringify({ error: "room_id, checkin, checkout, and adults are required" }),
          { status: 400, headers }
        );
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), INNPILOT_TIMEOUT_MS);

      try {
        const apiKey = env.BOOKING_API_KEY;
        const baseUrl = env.INNPILOT_BASE_URL || "https://app.inn-pilot.com";

        const quoteRes = await fetch(`${baseUrl}/api/public/quote`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            room_type: room_id,
            check_in: checkin,
            check_out: checkout,
            adults: Number(adults),
            children: Number(children || 0),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!quoteRes.ok) {
          const errText = await quoteRes.text().catch(() => "Quote API error");
          return new Response(
            JSON.stringify({ error: "Failed to validate quote", details: errText }),
            { status: 502, headers }
          );
        }

        const quoteData = await quoteRes.json();
        const sessionId = crypto.randomUUID();
        const serverTime = Date.now();
        const expiresAt = serverTime + 300000;

        return new Response(
          JSON.stringify({
            sessionId,
            serverTime,
            expiresAt,
            // InnPilot wraps successful responses as { success: true, data: {...} }.
            // Unwrap and transform so the restored session matches the /quote
            // BFF camelCase shape that booking.astro expects on recovery.
            quote: transformQuote(unwrapInnPilotData(quoteData)),
          }),
          { status: 200, headers }
        );
      } catch (err) {
        clearTimeout(timeoutId);
        if (err?.name === "AbortError") {
          return new Response(
            JSON.stringify({ error: "Request timeout. Please try again." }),
            { status: 504, headers }
          );
        }
        return new Response(
          JSON.stringify({ error: "Server error. Please try again." }),
          { status: 500, headers }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers }
    );
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers,
  });
}
