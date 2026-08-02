// Pure presentation/input helpers for the booking funnel.
//
// IMPORTANT: nothing in this file computes InnPilot rules (occupancy validity,
// minimum room count, availability, allocation validity, bedding requirement,
// bedding price, room rate or total). CFR is a presentation/input layer only.
// The helpers here parse user input and render what InnPilot returns verbatim.

import type {
  BeddingState,
  RoomAllocationEntry,
} from "./availability";

export type NumericField = "adults" | "children" | "rooms";

export interface NumericInputResult {
  value: number | null;
  error: string | null;
}

const FIELD_LABELS: Record<NumericField, string> = {
  adults: "Adults",
  children: "Children",
  rooms: "Rooms",
};

/**
 * Parse an open numeric typing field into a bounded integer.
 * Returns the value and (on failure) a customer-facing error.
 */
export function parseNumericGuestInput(
  raw: string | number | null | undefined,
  field: NumericField
): NumericInputResult {
  const label = FIELD_LABELS[field];
  const s = String(raw ?? "").trim();
  if (s === "") {
    return { value: null, error: `${label} is required` };
  }
  if (!/^\d+$/.test(s)) {
    return { value: null, error: `${label} must be a whole number` };
  }
  const n = Number(s);
  if (!Number.isFinite(n)) {
    return { value: null, error: `${label} must be a valid number` };
  }
  if (field === "adults") {
    if (n < 1) return { value: null, error: "At least 1 adult is required" };
    if (n > 20) return { value: null, error: "Adults cannot exceed 20" };
  } else if (field === "children") {
    if (n > 10) return { value: null, error: "Children cannot exceed 10" };
  } else {
    if (n < 1) return { value: null, error: "At least 1 room is required" };
    if (n > 12) return { value: null, error: "Rooms cannot exceed 12" };
  }
  return { value: n, error: null };
}

/** Human label for a whole party, e.g. "6 Adults, 4 Children". */
export function guestCountLabel(adults: number, children: number): string {
  const parts: string[] = [];
  parts.push(adults + (adults === 1 ? " Adult" : " Adults"));
  if (children > 0) {
    parts.push(children + (children === 1 ? " Child" : " Children"));
  }
  return parts.join(", ");
}

/** "3 Rooms required" (used on its own summary line). */
export function roomsRequiredLabel(rooms: number): string {
  return rooms + (rooms === 1 ? " Room required" : " Rooms required");
}

/** Occupancy description for a single allocated room. */
export function roomOccupancyLabel(room: RoomAllocationEntry): string {
  const parts: string[] = [];
  if (room.adults > 0) {
    parts.push(room.adults + (room.adults === 1 ? " adult" : " adults"));
  }
  if (room.children > 0) {
    parts.push(
      room.children + (room.children === 1 ? " child" : " children")
    );
  }
  return parts.join(" + ");
}

/** Display-only sum of the rooms the customer is viewing/editing. */
export function allocationGuestTotals(
  rooms: RoomAllocationEntry[]
): { adults: number; children: number } {
  let adults = 0;
  let children = 0;
  for (const r of rooms || []) {
    adults += Number(r.adults) || 0;
    children += Number(r.children) || 0;
  }
  return { adults, children };
}

/** True when the allocation mixes more than one room type. */
export function hasMixedRoomTypes(rooms: RoomAllocationEntry[]): boolean {
  if (!rooms || rooms.length < 2) return false;
  const first = rooms[0] && rooms[0].room_type;
  return rooms.some((r) => r.room_type !== first);
}

/** True when every room is the same type (or type unknown). */
export function isHomogeneousAllocation(rooms: RoomAllocationEntry[]): boolean {
  return !hasMixedRoomTypes(rooms);
}

/** Which room indexes currently require/select bedding. */
export function affectedBeddingRooms(
  rooms: RoomAllocationEntry[]
): number[] {
  const idx: number[] = [];
  (rooms || []).forEach((r, i) => {
    const b = r && r.bedding;
    if (b && (b.mandatory || b.selected)) idx.push(i);
  });
  return idx;
}

/** Customer-facing bedding label for one room. */
export function beddingDescription(bedding: BeddingState | null | undefined): string {
  if (!bedding) return "";
  const charge =
    bedding.chargePerNight > 0
      ? "₹" + Math.round(bedding.chargePerNight).toLocaleString("en-IN") + "/night"
      : "";
  if (bedding.mandatory) {
    return "Extra bedding required · " + charge;
  }
  if (bedding.optional) {
    return "Optional extra bedding · " + charge;
  }
  return "";
}

/** True when this room's bedding is mandatory per InnPilot. */
export function isBeddingMandatory(bedding: BeddingState | null | undefined): boolean {
  return !!(bedding && bedding.mandatory);
}

/** True when the customer may toggle this room's bedding. */
export function canToggleBedding(bedding: BeddingState | null | undefined): boolean {
  return !!(bedding && !bedding.mandatory && bedding.optional);
}

/** Descriptive line for one room in a mixed-type allocation. */
export function roomTypeDescription(
  room: RoomAllocationEntry,
  fallback: string
): string {
  const t = room && room.room_type ? room.room_type : fallback;
  return t || fallback;
}
