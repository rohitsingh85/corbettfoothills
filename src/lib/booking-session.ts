import type {
  BookingSession,
  SessionState,
  SessionToken,
  ServerTimestampResponse,
  PaymentMethod,
  BookingStep,
} from "../types/booking-session";
import {
  SESSION_DURATION_MS,
  SESSION_WARNING_THRESHOLD_MS,
  SESSION_URGENT_THRESHOLD_MS,
  SESSION_STORAGE_KEY,
} from "../types/booking-session";

let serverTimeOffset = 0;
let lastServerSync = 0;

function generateId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateSignature(sessionId: string, expiresAt: number): string {
  const data = `${sessionId}:${expiresAt}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

export function getNow(): number {
  return Date.now() + serverTimeOffset;
}

export function getRemainingMs(session: BookingSession): number {
  return Math.max(0, session.expiresAt - getNow());
}

export function getSessionState(session: BookingSession): SessionState {
  if (session.paymentStatus === "completed") return "confirmed";
  const remaining = getRemainingMs(session);
  if (remaining <= 0) return "expired";
  if (remaining <= SESSION_URGENT_THRESHOLD_MS) return "urgent";
  if (remaining <= SESSION_WARNING_THRESHOLD_MS) return "warning";
  return "active";
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function createSession(
  roomSlug: string,
  roomName: string,
  checkin: string,
  checkout: string,
  adults: number,
  children: number,
  quote: BookingSession["quote"],
  guest: BookingSession["guest"],
  quoteId?: string
): BookingSession {
  const now = getNow();
  const sessionId = generateId();
  return {
    sessionId,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
    serverTimeAtCreate: now,
    roomSlug,
    roomName,
    checkin,
    checkout,
    adults,
    children,
    quoteId,
    guest,
    quote,
    paymentMethod: null,
    paymentStatus: "pending",
    currentStep: "payment",
  };
}

export function persistSession(session: BookingSession): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage full or unavailable
  }
}

export function loadSession(): BookingSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as BookingSession;
    if (!session.sessionId || !session.expiresAt) return null;
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function updateSession(
  session: BookingSession,
  updates: Partial<Pick<BookingSession, "paymentMethod" | "paymentStatus" | "currentStep" | "guest">>
): BookingSession {
  const updated = { ...session, ...updates };
  persistSession(updated);
  return updated;
}

export function createSessionToken(session: BookingSession): SessionToken {
  return {
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
    sig: generateSignature(session.sessionId, session.expiresAt),
  };
}

export async function fetchServerTime(): Promise<ServerTimestampResponse> {
  try {
    const res = await fetch("/api/booking/session", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { serverTime: Date.now(), ok: false };
    const data = await res.json();
    const serverTime = data.serverTime || Date.now();
    serverTimeOffset = serverTime - Date.now();
    lastServerSync = Date.now();
    return { serverTime, ok: true };
  } catch {
    return { serverTime: Date.now(), ok: false };
  }
}

export function isSessionExpired(session: BookingSession): boolean {
  return getNow() >= session.expiresAt;
}

export function shouldWarnNavigation(session: BookingSession | null): boolean {
  if (!session) return false;
  const state = getSessionState(session);
  return state === "active" || state === "warning" || state === "urgent";
}

export function restoreSessionFromUrl(): Partial<BookingSession> | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const sessionData = params.get("session");
    if (!sessionData) return null;
    return JSON.parse(atob(sessionData));
  } catch {
    return null;
  }
}
