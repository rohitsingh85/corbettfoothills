export const SESSION_DURATION_MS = 300_000;
export const SESSION_WARNING_THRESHOLD_MS = 120_000;
export const SESSION_URGENT_THRESHOLD_MS = 60_000;
export const SESSION_STORAGE_KEY = "cfr_booking_session";

export type BookingStep =
  | "search"
  | "results"
  | "guests"
  | "review"
  | "payment"
  | "payment-qr"
  | "payment-upi"
  | "payment-checkin"
  | "session-expired"
  | "booking-confirmed"
  | "booking-error";

export type PaymentMethod = "upi-qr" | "upi-app" | "pay-at-checkin";

export type PaymentStatus =
  | "pending"
  | "method-selected"
  | "processing"
  | "completed"
  | "failed"
  | "expired";

export type SessionState =
  | "none"
  | "active"
  | "warning"
  | "urgent"
  | "expired"
  | "confirmed";

export interface BookingSession {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  serverTimeAtCreate: number;
  roomSlug: string;
  roomName: string;
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
  quoteId?: string;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country?: string;
    specialRequests?: string;
  };
  quote: {
    subtotal: number;
    totalTaxes: number;
    grandTotal: number;
    cancellationPolicy: string;
    taxBreakdown: Array<{ label: string; amount: number }>;
    nightlyRate: number;
    totalStay: number;
  };
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  currentStep: BookingStep;
}

export interface SessionToken {
  sessionId: string;
  expiresAt: number;
  sig: string;
}

export interface ServerTimestampResponse {
  serverTime: number;
  ok: boolean;
}
