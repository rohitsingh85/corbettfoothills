# Cloudflare Pages Secrets & Environment Variables

Set these in the Cloudflare Pages dashboard
(`corbett.life` → **Settings** → **Environment variables** → **Production**):

## Secrets (must be encrypted)

| Variable | Description |
|---|---|
| `BREVO_API_KEY` | Brevo (Sendinblue) API v3 key |
| `BOOKING_API_KEY` | InnPilot API key — used server-side by the BFF proxy (`/api/booking/availability`). Never exposed to the browser. |
| `RAZORPAY_KEY_ID` | Razorpay API Key ID (starts with `rzp_live_` or `rzp_test_`). Reaches the browser only via the `/api/booking/submit` response. |
| `RAZORPAY_KEY_SECRET` | Razorpay API Key Secret — server-side only. Never exposed to the browser. |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signature secret — used to verify webhook requests from Razorpay at the InnPilot endpoint. |

## Plain-text Variables

| Variable | Value | Description |
|---|---|---|
| `BREVO_LIST_WEBSITE_ENQUIRIES` | `5` | Brevo list ID for contact form enquiries |
| `BREVO_LIST_NEWSLETTER` | `7` | Brevo list ID for newsletter subscribers |
| `BREVO_LIST_WHATSAPP` | `8` | Brevo list ID for WhatsApp opt-ins |
| `BREVO_WELCOME_TEMPLATE_ID` | `1` | Brevo transactional email template ID for the welcome email |
| `INNPILOT_BASE_URL` | `https://app.inn-pilot.com` | (Optional) Override InnPilot API base URL for the availability proxy |
| `SENDER_EMAIL` | `welcome@corbett.life` | From-address for automated emails (set in wrangler.toml `[vars]`) |
| `SENDER_NAME` | `Corbett Foothills Retreat` | From-name for automated emails (set in wrangler.toml `[vars]`) |

## Razorpay Webhook

- **Production webhook endpoint:** `https://app.inn-pilot.com/api/public/payment/razorpay-webhook`
- Configure in the Razorpay Dashboard: **Settings → Webhooks → Add Webhook**
- Enter the URL above, select `payment.captured` and `payment.failed` events
- Set the webhook secret (`RAZORPAY_WEBHOOK_SECRET`) to a strong random value
- The same secret must be set on the InnPilot Worker (managed separately)
- The webhook is handled server-side by InnPilot — this website does not expose a webhook endpoint

## Brevo Setup

1. **Verify sender** — `welcome@corbett.life` must be authenticated in Brevo
   (Brevo → **Sender Identity** → **Add a Sender** → verify domain or address).
2. **Create lists** — Create the three lists in Brevo (**Contacts** → **Lists**)
   with the IDs above. The IDs appear in the URL when viewing a list.
3. **API key** — Generate a v3 API key (Brevo → **Settings** → **API Keys**).
