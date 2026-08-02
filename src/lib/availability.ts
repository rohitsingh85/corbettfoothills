export interface AvailabilityParams {
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
  rooms: number;
}

/**
 * Authoritative bedding state for a single room, provided by InnPilot.
 * CFR only renders it — it never decides whether bedding is optional,
 * mandatory, or how much it costs.
 */
export interface BeddingState {
  /** True when the assigned occupancy requires bedding (checked + disabled). */
  mandatory: boolean;
  /** True when the customer may opt in to extra bedding. */
  optional: boolean;
  /** Charge per night for this affected room (₹). */
  chargePerNight: number;
  /** Customer's current selection. */
  selected: boolean;
  /** Optional short label (e.g. "Extra bed", "Child cot"). */
  label?: string;
}

/**
 * Per-room entry inside an InnPilot allocation. CFR renders `room_type`,
 * occupancy, bedding and per-room pricing verbatim for mixed-type allocations.
 */
export interface RoomAllocationEntry {
  adults: number;
  children: number;
  room_type?: string | null;
  bedding?: BeddingState | null;
  nightly_rate?: number | null;
  room_total?: number | null;
  bedding_total?: number | null;
}

/**
 * One customer-selectable allocation. InnPilot enumerates the meaningful
 * alternatives (never CFR) and may flag a recommended (lowest-cost) option.
 */
export interface AllocationOption {
  rooms: RoomAllocationEntry[];
  total?: number | null;
  recommended?: boolean | null;
}

export type AvailabilityErrorCode =
  | "OCCUPANCY_IMPOSSIBLE"
  | "INSUFFICIENT_INVENTORY"
  | "NO_VALID_ALLOCATION"
  | "MIXED_ROOM_TYPES_REQUIRED";

/**
 * Authoritative reason InnPilot gives when the requested room count cannot be
 * satisfied. Distinguishes occupancy failure from inventory failure.
 */
export interface AvailabilityErrorInfo {
  code: AvailabilityErrorCode;
  message: string;
  minimum_rooms?: number | null;
}

export interface PackageItem {
  id: string;
  name: string;
  description: string;
  price: number;
  included: boolean;
  tier: "included" | "optional" | "recommended" | "unavailable";
}

export interface RoomOccupancy {
  maxAdults: number;
  maxChildren: number;
  maxOccupancy: number;
  roomsRequired: number | null;
  fits: boolean;
  allocation: RoomAllocationEntry[] | null;
  label: string;
}

export interface RoomAvailability {
  slug: string;
  name: string;
  room_type: string;
  available: boolean;
  fits: boolean;
  rooms_required: number | null;
  /** Minimum rooms needed to house the party (occupancy only). */
  minimum_rooms: number | null;
  /** What the customer explicitly requested. */
  requested_rooms: number | null;
  /** Preferred single allocation (backward-compatible fallback). */
  allocation: RoomAllocationEntry[] | null;
  /** Customer-selectable alternatives when InnPilot offers more than one. */
  allocation_options: AllocationOption[] | null;
  /** Authoritative reason when the requested count cannot be satisfied. */
  availability_error: AvailabilityErrorInfo | null;
  roomsLeft: number;
  max_adults: number;
  max_children: number;
  max_occupancy: number;
  occupancy: RoomOccupancy;
  nightlyRate: number;
  originalNightlyRate?: number;
  totalStay: number;
  originalTotal?: number;
  nights: number;
  currency: string;
  packages: PackageItem[];
  cancellationPolicy: string;
  taxBreakdown: {
    label: string;
    amount: number;
  }[];
  totalTaxes: number;
  grandTotal: number;
}

export interface AvailabilityResponse {
  success: boolean;
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
  rooms: RoomAvailability[];
  message?: string;
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTomorrowStr(): string {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getDayAfterTomorrowStr(): string {
  const now = new Date();
  now.setDate(now.getDate() + 2);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
