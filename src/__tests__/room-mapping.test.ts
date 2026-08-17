import { describe, it, expect } from "vitest";
import {
  ROOM_MAPPING,
  DEFAULT_ROOM,
  resolveRoomSlug,
  resolveRoomContent,
} from "../data/roomMapping";
import { rooms } from "../data/rooms";
import { ROOM_GALLERY } from "../data/roomGallery";

describe("ROOM_MAPPING", () => {
  it("maps known PMS room types to website content slugs", () => {
    expect(ROOM_MAPPING["Deluxe Room"]).toBe("family-lodge");
  });

  it("every mapped slug exists in the room content list", () => {
    const slugs = new Set(rooms.map((r) => r.slug));
    for (const slug of Object.values(ROOM_MAPPING)) {
      expect(slugs.has(slug)).toBe(true);
    }
  });
});

describe("resolveRoomSlug", () => {
  it("returns the content slug for a known PMS room type", () => {
    expect(resolveRoomSlug("Deluxe Room")).toBe("family-lodge");
  });

  it("matches existing content slugs directly", () => {
    expect(resolveRoomSlug("family-lodge")).toBe("family-lodge");
    expect(resolveRoomSlug("river-cottage")).toBe("river-cottage");
  });

  it("matches PMS-style names to content slugs via normalisation", () => {
    expect(resolveRoomSlug("River Cottage")).toBe("river-cottage");
    expect(resolveRoomSlug("Jungle View Room")).toBe("jungle-view-room");
    expect(resolveRoomSlug("Garden Suite")).toBe("garden-suite");
    expect(resolveRoomSlug("Canopy Room")).toBe("canopy-room");
  });

  it("returns undefined for unknown room identifiers", () => {
    expect(resolveRoomSlug("Royal Penthouse")).toBeUndefined();
    expect(resolveRoomSlug("")).toBeUndefined();
  });
});

describe("resolveRoomContent", () => {
  it("resolves a known PMS room type to its website content", () => {
    const content = resolveRoomContent("Deluxe Room");
    expect(content.slug).toBe("family-lodge");
    expect(content.name).toBe("The Family Lodge");
    expect(content.gallery.length).toBeGreaterThan(0);
    expect(content.amenities.length).toBeGreaterThan(0);
  });

  it("resolves a website content slug directly", () => {
    const content = resolveRoomContent("forest-suite");
    expect(content.slug).toBe("forest-suite");
  });

  it("returns the default content for unknown rooms", () => {
    const content = resolveRoomContent("Royal Penthouse");
    expect(content).toBe(DEFAULT_ROOM);
  });

  it("default content keeps rendering working (gallery, amenities, description)", () => {
    expect(DEFAULT_ROOM.gallery.length).toBe(ROOM_GALLERY.length);
    expect(DEFAULT_ROOM.gallery.every((src) => src.startsWith("/images/"))).toBe(true);
    expect(DEFAULT_ROOM.amenities.length).toBeGreaterThan(0);
    expect(DEFAULT_ROOM.description.length).toBeGreaterThan(0);
    expect(DEFAULT_ROOM.shortDescription.length).toBeGreaterThan(0);
    expect(DEFAULT_ROOM.image).toBeTruthy();
  });

  it("default content never breaks on undefined input", () => {
    expect(resolveRoomContent("")).toBe(DEFAULT_ROOM);
    expect(resolveRoomContent(undefined as unknown as string)).toBe(DEFAULT_ROOM);
  });
});
