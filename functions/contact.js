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
    return env.ASSETS.fetch(request);
  }

  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const windowMs = 60000;
  const maxReqs = 5;
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
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers,
    });
  }

  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || "").trim();
  const checkin = (body.checkin || "").trim();
  const checkout = (body.checkout || "").trim();
  const guests = (body.guests || "").trim();
  const message = (body.message || "").trim();

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: "Name, email, and message are required" }), {
      status: 400,
      headers,
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

  const val = (v) => v || "—";

  const rows = [
    { field: "Name", value: val(name) },
    { field: "Email", value: val(email) },
    { field: "Phone", value: val(phone) },
    { field: "Check-in", value: val(checkin) },
    { field: "Check-out", value: val(checkout) },
    { field: "Guests", value: val(guests) },
    { field: "Message", value: val(message) },
  ];

  const tableRows = rows
    .map(
      (r, i) =>
        `<tr${i < rows.length - 1 ? ' style="border-bottom: 1px solid #e0ceb0;"' : ""}>
          <td style="padding: 12px 16px; color: #1a4a3f; font-size: 14px; font-weight: 600; vertical-align: top; width: 30%;">${r.field}</td>
          <td style="padding: 12px 16px; color: #3d281e; font-size: 14px; white-space: ${r.field === "Message" ? "pre-wrap" : "normal"}; vertical-align: top;">${r.value}</td>
        </tr>`
    )
    .join("");

  const htmlContent = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background-color: #faf8f5;">
      <p style="color: #3d281e; font-size: 16px; line-height: 1.7;">Hello,</p>
      <p style="color: #3d281e; font-size: 16px; line-height: 1.7;">
        A website visitor submitted the following information on the <strong style="color: #1a4a3f;">corbett.life</strong> website.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 24px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr style="background-color: #1a4a3f;">
          <th style="padding: 12px 16px; text-align: left; color: #ffffff; font-size: 14px; font-weight: 600;">Field</th>
          <th style="padding: 12px 16px; text-align: left; color: #ffffff; font-size: 14px; font-weight: 600;">Value</th>
        </tr>
        ${tableRows}
      </table>
      <p style="color: #8a7254; font-size: 12px; margin-top: 24px; text-align: center;">
        This email was sent from the contact form on corbett.life.
      </p>
    </div>
  `;

  try {
    const emailPayload = {
      sender: { email: env.SENDER_EMAIL || "noreply@corbett.life", name: env.SENDER_NAME || "Corbett Foothills Retreat" },
      to: [{ email: "welcome@corbett.life" }],
      subject: `New inquiry from ${name} — corbett.life`,
      htmlContent,
    };

    const emailRes = await fetch(`${BREVO_API}/smtp/email`, {
      method: "POST",
      headers: brevoHeaders,
      body: JSON.stringify(emailPayload),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Brevo email error:", emailRes.status, errText);
      return new Response(JSON.stringify({ error: "Failed to send message" }), {
        status: 500,
        headers,
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error("Contact form error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers,
    });
  }
}
