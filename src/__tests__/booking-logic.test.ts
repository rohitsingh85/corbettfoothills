import { describe, it, expect } from "vitest";
import {
  parseNumericGuestInput,
  guestCountLabel,
  roomsRequiredLabel,
  roomOccupancyLabel,
  allocationGuestTotals,
  hasMixedRoomTypes,
  isHomogeneousAllocation,
  affectedBeddingRooms,
  beddingDescription,
  isBeddingMandatory,
  canToggleBedding,
  roomTypeDescription,
} from "../lib/booking-logic";
import type { RoomAllocationEntry } from "../lib/availability";

function room(overrides: Partial<RoomAllocationEntry> = {}): RoomAllocationEntry {
  return {
    adults: 2,
    children: 0,
    room_type: null,
    nightly_rate: null,
    room_total: null,
    bedding_total: null,
    bedding: null,
    ...overrides,
  };
}

describe("parseNumericGuestInput", () => {
  it("parses plain integers for adults/children/rooms", () => {
    expect(parseNumericGuestInput("4", "adults")).toEqual({ value: 4, error: null });
    expect(parseNumericGuestInput("3", "children")).toEqual({ value: 3, error: null });
    expect(parseNumericGuestInput("2", "rooms")).toEqual({ value: 2, error: null });
  });

  it("rejects empty input with a per-field label", () => {
    expect(parseNumericGuestInput("", "adults")).toEqual({
      value: null,
      error: "Adults is required",
    });
    expect(parseNumericGuestInput("  ", "rooms")).toEqual({
      value: null,
      error: "Rooms is required",
    });
  });

  it("rejects non-numeric and fractional input", () => {
    expect(parseNumericGuestInput("abc", "adults")).toEqual({
      value: null,
      error: "Adults must be a whole number",
    });
    expect(parseNumericGuestInput("2.5", "children")).toEqual({
      value: null,
      error: "Children must be a whole number",
    });
    expect(parseNumericGuestInput("-1", "rooms")).toEqual({
      value: null,
      error: "Rooms must be a whole number",
    });
  });

  it("enforces bounds per field", () => {
    expect(parseNumericGuestInput("0", "adults")).toEqual({
      value: null,
      error: "At least 1 adult is required",
    });
    expect(parseNumericGuestInput("21", "adults")).toEqual({
      value: null,
      error: "Adults cannot exceed 20",
    });
    expect(parseNumericGuestInput("11", "children")).toEqual({
      value: null,
      error: "Children cannot exceed 10",
    });
    expect(parseNumericGuestInput("0", "rooms")).toEqual({
      value: null,
      error: "At least 1 room is required",
    });
    expect(parseNumericGuestInput("13", "rooms")).toEqual({
      value: null,
      error: "Rooms cannot exceed 12",
    });
  });
});

describe("guestCountLabel / roomsRequiredLabel", () => {
  it("builds a singular/plural party label", () => {
    expect(guestCountLabel(1, 0)).toBe("1 Adult");
    expect(guestCountLabel(2, 1)).toBe("2 Adults, 1 Child");
    expect(guestCountLabel(3, 4)).toBe("3 Adults, 4 Children");
  });

  it("builds the rooms-required line", () => {
    expect(roomsRequiredLabel(1)).toBe("1 Room required");
    expect(roomsRequiredLabel(3)).toBe("3 Rooms required");
  });
});

describe("roomOccupancyLabel / allocationGuestTotals", () => {
  it("describes a single allocated room", () => {
    expect(roomOccupancyLabel(room({ adults: 2, children: 1 }))).toBe(
      "2 adults + 1 child"
    );
    expect(roomOccupancyLabel(room({ adults: 1 }))).toBe("1 adult");
  });

  it("sums adults and children across the allocation", () => {
    const rooms = [
      room({ adults: 2, children: 1 }),
      room({ adults: 2, children: 0 }),
    ];
    expect(allocationGuestTotals(rooms)).toEqual({ adults: 4, children: 1 });
  });

  it("tolerates missing values", () => {
    expect(allocationGuestTotals([])).toEqual({ adults: 0, children: 0 });
  });
});

describe("hasMixedRoomTypes / isHomogeneousAllocation", () => {
  it("detects mixed-type allocations", () => {
    expect(
      hasMixedRoomTypes([room({ room_type: "Standard" }), room({ room_type: "Family" })])
    ).toBe(true);
    expect(
      hasMixedRoomTypes([room({ room_type: "Standard" }), room({ room_type: "Standard" })])
    ).toBe(false);
    expect(hasMixedRoomTypes([room()])).toBe(false);
  });

  it("mirrors as homogeneous", () => {
    expect(isHomogeneousAllocation([room(), room()])).toBe(true);
    expect(
      isHomogeneousAllocation([room({ room_type: "A" }), room({ room_type: "B" })])
    ).toBe(false);
  });
});

describe("bedding helpers", () => {
  const mandatory = { mandatory: true, optional: true, selected: false, chargePerNight: 750 };
  const optional = { mandatory: false, optional: true, selected: false, chargePerNight: 750 };

  it("flags affected rooms only when bedding is mandatory or selected", () => {
    const rooms = [
      room({ bedding: mandatory }),
      room({ bedding: optional }),
      room({ bedding: { ...optional, selected: true } }),
      room(),
    ];
    expect(affectedBeddingRooms(rooms)).toEqual([0, 2]);
  });

  it("describes bedding with the per-night charge", () => {
    expect(beddingDescription(mandatory)).toBe(
      "Extra bedding required · ₹750/night"
    );
    expect(beddingDescription(optional)).toBe("Optional extra bedding · ₹750/night");
    expect(beddingDescription(null)).toBe("");
  });

  it("exposes mandatory and toggleable state", () => {
    expect(isBeddingMandatory(mandatory)).toBe(true);
    expect(isBeddingMandatory(optional)).toBe(false);
    expect(canToggleBedding(optional)).toBe(true);
    expect(canToggleBedding(mandatory)).toBe(false);
  });

  it("falls back to the room type description", () => {
    expect(roomTypeDescription(room({ room_type: "Family" }), "Room")).toBe("Family");
    expect(roomTypeDescription(room(), "Room")).toBe("Room");
  });
});
