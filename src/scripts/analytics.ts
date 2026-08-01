declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
    Razorpay?: unknown;
    CFR_ANALYTICS?: CFRClient;
  }
}

interface CFRClient {
  track(name: string, params?: Record<string, unknown>): void;
  trackOnce(name: string, token: string, params?: Record<string, unknown>): void;
  readonly debug: boolean;
  readonly enabled: boolean;
  readonly measurementId: string;
}

const FALLBACK_ID = "G-XXXXXXXXXX";
const PROPERTY_NAME = "Corbett Foothills Retreat";

const measurementId: string =
  import.meta.env.PUBLIC_GA4_MEASUREMENT_ID || FALLBACK_ID;
const enabled =
  measurementId !== FALLBACK_ID && /^G-[A-Z0-9]{4,}$/.test(measurementId);
const isDebug =
  import.meta.env.DEV ||
  import.meta.env.PUBLIC_GA4_DEBUG === "1" ||
  (typeof location !== "undefined" &&
    new URLSearchParams(location.search).has("ga_debug"));

function log(name: string, params?: Record<string, unknown>) {
  if (!isDebug) return;
  console.log(`[CFR Analytics] ${name}`, params ?? "");
}

window.dataLayer = window.dataLayer || [];

function push(...args: unknown[]) {
  window.dataLayer!.push(args);
}

function gtag(...args: unknown[]) {
  push(...args);
}
window.gtag = gtag;

if (enabled) {
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.onload = () => log("gtag_loaded", { measurementId });
  document.head.appendChild(script);
  push("js", new Date());
  push("config", measurementId, {
    send_page_view: true,
    transport_type: "beacon",
  });
}

let lastPath = "";

function currentPath() {
  return window.location.pathname + window.location.search;
}

function trackPageView() {
  const path = currentPath();
  if (path === lastPath) return;
  lastPath = path;
  if (enabled) {
    push("config", measurementId, { page_path: path, send_page_view: true });
  }
  log("page_view", { page_path: path, page_title: document.title });
}

const originalPushState = history.pushState.bind(history);
history.pushState = function (...args: Parameters<History["pushState"]>) {
  const result = originalPushState(...args);
  window.setTimeout(trackPageView, 0);
  return result;
};

window.addEventListener("popstate", trackPageView);
window.addEventListener("pageshow", (e) => {
  if (e.persisted) trackPageView();
});

lastPath = currentPath();
log("page_view", { page_path: lastPath, page_title: document.title });

function track(name: string, params?: Record<string, unknown>) {
  if (enabled) {
    gtag("event", name, params || {});
  }
  log(name, params ?? {});
}

function trackOnce(
  name: string,
  token: string,
  params?: Record<string, unknown>
) {
  if (!token) {
    track(name, params);
    return;
  }
  const key = `cfr_ga_evt:${name}:${token}`;
  try {
    if (window.sessionStorage.getItem(key)) {
      log(`${name}:blocked`, params ?? {});
      return;
    }
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* storage unavailable — still send the event */
  }
  track(name, params);
}

document.addEventListener("click", (e) => {
  const target = e.target as Element | null;
  const link = target?.closest?.("a");
  if (!(link instanceof HTMLAnchorElement)) return;
  const href = link.href || "";
  const label = (link.textContent || "").trim().slice(0, 60);

  if (href.startsWith("tel:")) {
    track("phone_click", { link_text: label });
  } else if (href.startsWith("mailto:")) {
    track("email_click", { link_text: label });
  } else if (/wa\.me|whatsapp/i.test(href)) {
    track("whatsapp_click", { link_text: label });
  } else if (
    /maps\.google\.com|google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(
      href
    )
  ) {
    track("directions_click", { link_text: label });
  }
});

const api: CFRClient = {
  track,
  trackOnce,
  debug: isDebug,
  enabled,
  measurementId,
};

window.CFR_ANALYTICS = api;

if (isDebug) {
  log("init", { measurementId, enabled });
}

export {};
