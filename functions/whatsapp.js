const BREVO_API = "https://api.brevo.com/v3";
const fmtPhone = (p) => {
  if (!p) return "";
  const digits = p.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return digits;
};
const rateLimitMap = new Map();

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

  // IP-based rate limiting
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const windowMs = 60000;
  const maxReqs = 5;
  const entry = rateLimitMap.get(ip);
  if (entry) {
    const recent = entry.filter((t) => now - t < windowMs);
    if (recent.length >= maxReqs) {
      return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
        status: 429,
        headers,
      });
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
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers,
    });
  }

  const phone = (body.phone || "").trim();
  const name = (body.name || "").trim();

  if (!phone) {
    return new Response(JSON.stringify({ error: "Phone number is required" }), {
      status: 400,
      headers,
    });
  }

  if (!/^[1-9]\d{9,14}$/.test(phone.replace(/[^0-9]/g, ""))) {
    return new Response(JSON.stringify({ error: "Invalid phone number" }), {
      status: 400,
      headers,
    });
  }

  const apiKey = env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY not configured");
    return new Response(JSON.stringify({ error: "Service not configured" }), {
      status: 500,
      headers,
    });
  }

  const brevoHeaders = {
    "api-key": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const contactEmail = `phone-${cleanPhone}@corbett.life`;

  try {
    const listId = parseInt(env.BREVO_LIST_WHATSAPP || "8", 10);
    const attributes = {
      OPT_IN: true,
      SMS: fmtPhone(phone),
      WHATSAPP_OPTIN: "true",
      SUBSCRIBED_AT: new Date().toISOString(),
    };
    if (name) attributes.FIRSTNAME = name;

    const contactPayload = {
      email: contactEmail,
      updateEnabled: true,
      listIds: [listId],
      attributes,
    };

    const contactRes = await fetch(`${BREVO_API}/contacts`, {
      method: "POST",
      headers: brevoHeaders,
      body: JSON.stringify(contactPayload),
    });

    if (!contactRes.ok && contactRes.status !== 409) {
      const errText = await contactRes.text();
      console.error("Brevo WhatsApp opt-in error:", contactRes.status, errText);
      return new Response(JSON.stringify({ error: "Failed to process opt-in" }), {
        status: 500,
        headers,
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error("WhatsApp opt-in error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers,
    });
  }
}
