const BREVO_API = "https://api.brevo.com/v3";
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

  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || "").trim();
  const honeypot = (body.website || "").trim();

  // Honeypot spam check
  if (honeypot) {
    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  }

  // Validate at least one contact method
  if (!email && !phone) {
    return new Response(JSON.stringify({ error: "Email or phone number required" }), {
      status: 400,
      headers,
    });
  }

  // Email validation
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email address" }), {
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

  // Use email if provided, otherwise generate a placeholder for Brevo contact
  const contactEmail = email || `phone-${phone.replace(/[^0-9]/g, "")}@corbett.life`;

  // Prefer the documented variable name (BREVO_LIST_NEWSLETTER) but keep
  // BREVO_LIST_ID working as a fallback for existing deployments.
  const listIdRaw = env.BREVO_LIST_NEWSLETTER || env.BREVO_LIST_ID || "";
  const listIds = listIdRaw ? [parseInt(listIdRaw, 10)] : [];

  try {
    // Step 1: Add/update contact in Brevo
    const attributes = {
      OPT_IN: true,
      SUBSCRIBED_AT: new Date().toISOString(),
    };
    if (phone) attributes.SMS = phone;

    const contactPayload = {
      email: contactEmail,
      updateEnabled: true,
      listIds,
      attributes,
    };

    const contactRes = await fetch(`${BREVO_API}/contacts`, {
      method: "POST",
      headers: brevoHeaders,
      body: JSON.stringify(contactPayload),
    });

    if (!contactRes.ok && contactRes.status !== 409) {
      let detail = "";
      try {
        detail = (await contactRes.text()).slice(0, 500);
      } catch {}
      console.error("Brevo contact error:", contactRes.status, detail);
      return new Response(
        JSON.stringify({ error: "Failed to subscribe", status: contactRes.status, detail }),
        { status: 500, headers }
      );
    }

    // Step 2: Send welcome email (only if real email provided)
    if (email) {
      const senderEmail = env.SENDER_EMAIL || "noreply@corbett.life";
      const senderName = env.SENDER_NAME || "Corbett Foothills Retreat";

      const emailPayload = {
        sender: { email: senderEmail, name: senderName },
        to: [{ email }],
        subject: "Welcome to Corbett Foothills Retreat",
        htmlContent: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background-color: #faf8f5;">
            <div style="text-align: center; padding-bottom: 24px; border-bottom: 2px solid #2d6a4f;">
              <h1 style="color: #1a4a3f; font-size: 24px; margin: 0;">Corbett Foothills Retreat</h1>
            </div>
            <div style="padding: 32px 0;">
              <p style="color: #3d281e; font-size: 16px; line-height: 1.7;">Dear guest,</p>
              <p style="color: #3d281e; font-size: 16px; line-height: 1.7;">
                Welcome to the Corbett Foothills community. Get travel inspiration, special offers, and stories from the forest.
              </p>
              <p style="color: #3d281e; font-size: 16px; line-height: 1.7;">
                We are thrilled to have you with us as we share the beauty, tranquility, and wild spirit of the Corbett landscape.
              </p>
              <p style="color: #3d281e; font-size: 16px; line-height: 1.7;">
                In the coming weeks, you will hear from us about seasonal wildlife sightings, exclusive stay offers, sustainable travel tips, and stories from the edge of the jungle.
              </p>
              <p style="color: #3d281e; font-size: 16px; line-height: 1.7;">
                If you have any questions or would like to plan your visit, simply reply to this email — we would love to hear from you.
              </p>
              <p style="color: #3d281e; font-size: 16px; line-height: 1.7;">
                Until then, may your days be filled with birdsong and quiet forest moments.
              </p>
              <p style="color: #3d281e; font-size: 16px; line-height: 1.7; margin-top: 24px;">
                With warmth,<br>
                <strong style="color: #1a4a3f;">The Corbett Foothills Retreat Team</strong>
              </p>
            </div>
            <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e0ceb0; font-size: 12px; color: #8a7254;">
              <p>Corbett Foothills Retreat · Gaibua Khas, Bail Parao · Ramnagar, Uttarakhand</p>
              <p style="margin-top: 8px;">
                <a href="{{unsubscribe}}" style="color: #8a7254; text-decoration: underline;">Unsubscribe</a>
              </p>
            </div>
          </div>
        `,
      };

      const emailRes = await fetch(`${BREVO_API}/smtp/email`, {
        method: "POST",
        headers: brevoHeaders,
        body: JSON.stringify(emailPayload),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error("Brevo email error:", emailRes.status, errText);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error("Newsletter error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers,
    });
  }
}
