export interface AvailabilityParams {
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
}

export interface PackageItem {
  id: string;
  name: string;
  description: string;
  price: number;
  included: boolean;
  tier: "included" | "optional" | "recommended" | "unavailable";
}

export interface RoomAllocationEntry {
  adults: number;
  children: number;
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
  allocation: RoomAllocationEntry[] | null;
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
