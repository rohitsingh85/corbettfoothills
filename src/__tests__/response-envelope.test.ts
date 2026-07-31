import { describe, it, expect } from "vitest";
import { unwrapInnPilotData } from "../../functions/api/booking/_response-envelope.js";

describe("unwrapInnPilotData", () => {
  describe("InnPilot success envelope", () => {
    it("returns the inner data payload", () => {
      const payload = { success: true, data: { roomId: 5, price: 6000 } };
      expect(unwrapInnPilotData(payload)).toEqual({ roomId: 5, price: 6000 });
    });

    it("returns the same object identity (no copy)", () => {
      const inner = { available: true };
      expect(unwrapInnPilotData({ success: true, data: inner })).toBe(inner);
    });

    it("unwraps when data is a falsy primitive (0, '', false)", () => {
      expect(unwrapInnPilotData({ success: true, data: 0 })).toBe(0);
      expect(unwrapInnPilotData({ success: true, data: "" })).toBe("");
      expect(unwrapInnPilotData({ success: true, data: false })).toBe(false);
    });

    it("unwraps when data is an empty object or array", () => {
      expect(unwrapInnPilotData({ success: true, data: {} })).toEqual({});
      expect(unwrapInnPilotData({ success: true, data: [] })).toEqual([]);
    });

    it("unwraps even when success flag is missing (legacy payloads)", () => {
      expect(unwrapInnPilotData({ data: { code: "CONF-ABC" } })).toEqual({ code: "CONF-ABC" });
    });
  });

  describe("InnPilot error envelope", () => {
    it("returns the envelope unchanged", () => {
      const payload = { success: false, error: { code: "NOT_FOUND", message: "No rooms" } };
      expect(unwrapInnPilotData(payload)).toBe(payload);
    });

    it("preserves error details", () => {
      const payload = {
        success: false,
        error: { code: "VALIDATION", message: "bad", details: { field: "email" } },
      };
      const result = unwrapInnPilotData(payload) as typeof payload;
      expect(result).toBe(payload);
      expect(result.error.details).toEqual({ field: "email" });
    });

    it("does not unwrap an error envelope that also carries a data field", () => {
      const payload = { success: false, error: { code: "X", message: "y" }, data: { sneaky: true } };
      expect(unwrapInnPilotData(payload)).toBe(payload);
    });
  });

  describe("already-unwrapped / legacy payloads", () => {
    it("returns a plain object without a data field unchanged", () => {
      const payload = { rooms: [], totalRooms: 3 };
      expect(unwrapInnPilotData(payload)).toBe(payload);
    });

    it("returns a payload whose data field is null unchanged", () => {
      const payload = { data: null, note: "empty" };
      expect(unwrapInnPilotData(payload)).toBe(payload);
    });

    it("returns a payload whose data field is undefined unchanged", () => {
      const payload = { data: undefined, note: "empty" };
      expect(unwrapInnPilotData(payload)).toBe(payload);
    });
  });

  describe("single-level unwrap", () => {
    it("never re-unwraps a nested data field", () => {
      const payload = { success: true, data: { success: true, data: { deep: true } } };
      const result = unwrapInnPilotData(payload) as unknown as {
        success: boolean;
        data: { deep: boolean };
      };
      expect(result).toEqual({ success: true, data: { deep: true } });
    });
  });

  describe("non-object inputs pass through", () => {
    it("returns null unchanged", () => {
      expect(unwrapInnPilotData(null)).toBeNull();
    });

    it("returns undefined unchanged", () => {
      expect(unwrapInnPilotData(undefined)).toBeUndefined();
    });

    it("returns arrays unchanged (never unwraps array.data)", () => {
      const arr = [{ a: 1 }, { b: 2 }];
      expect(unwrapInnPilotData(arr)).toBe(arr);
    });

    it("returns primitives unchanged", () => {
      expect(unwrapInnPilotData("hello")).toBe("hello");
      expect(unwrapInnPilotData(42)).toBe(42);
      expect(unwrapInnPilotData(true)).toBe(true);
      expect(unwrapInnPilotData(0)).toBe(0);
      expect(unwrapInnPilotData("")).toBe("");
    });
  });

  describe("never throws", () => {
    it("handles functions", () => {
      const fn = () => "x";
      expect(unwrapInnPilotData(fn as unknown)).toBe(fn);
    });

    it("handles symbols", () => {
      const sym = Symbol("s");
      expect(unwrapInnPilotData(sym as unknown)).toBe(sym);
    });

    it("handles Date and Map instances", () => {
      const date = new Date("2026-08-01T00:00:00Z");
      expect(unwrapInnPilotData(date as unknown)).toBe(date);
      const map = new Map([["a", 1]]);
      expect(unwrapInnPilotData(map as unknown)).toBe(map);
    });

    it("handles null-prototype objects", () => {
      const payload = Object.create(null);
      payload.success = true;
      payload.data = { ok: 1 };
      expect(unwrapInnPilotData(payload)).toEqual({ ok: 1 });
    });
  });
});
