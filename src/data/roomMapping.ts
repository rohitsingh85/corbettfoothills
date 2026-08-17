import { rooms, type RoomContent } from "./rooms";
import { ROOM_GALLERY } from "./roomGallery";

export const ROOM_MAPPING: Record<string, string> = {
  "Deluxe Room": "family-lodge",
};

export const DEFAULT_ROOM: RoomContent = {
  slug: "default",
  name: "",
  description:
    "A comfortable stay at Corbett Foothills Retreat, with easy access to the organic farm, forest trails, and everything the retreat has to offer.",
  shortDescription:
    "A comfortable room at Corbett Foothills Retreat — relax, explore the farm, and enjoy the forest.",
  image: ROOM_GALLERY[0],
  gallery: ROOM_GALLERY,
  maxOccupancy: { adults: 2, children: 1 },
  bedType: "",
  area: "",
  amenities: ["Free WiFi", "Hot Water", "Daily Housekeeping", "Complimentary Parking"],
  highlights: [],
  smoking: false,
  accessibility: false,
  cancellationPolicy: "",
};

function normalizeKey(k: string): string {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const mappingLookup: Record<string, string> = {};
for (const [pmsType, slug] of Object.entries(ROOM_MAPPING)) {
  mappingLookup[normalizeKey(pmsType)] = slug;
}

const slugLookup: Record<string, string> = {};
for (const room of rooms) {
  slugLookup[normalizeKey(room.slug)] = room.slug;
}

export function resolveRoomSlug(identifier: string): string | undefined {
  const key = normalizeKey(identifier);
  if (!key) return undefined;
  if (slugLookup[key]) return slugLookup[key];
  return mappingLookup[key];
}

export function resolveRoomContent(identifier: string): RoomContent {
  const slug = resolveRoomSlug(identifier);
  if (slug) {
    const room = rooms.find((r) => r.slug === slug);
    if (room) return room;
  }
  if (import.meta.env.DEV) {
    console.warn(`[roomMapping] No content for "${identifier}", using default room content.`);
  }
  return DEFAULT_ROOM;
}
