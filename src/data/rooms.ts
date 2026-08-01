import { ROOM_GALLERY } from "./roomGallery";

export interface RoomContent {
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  image: string;
  gallery: string[];
  maxOccupancy: { adults: number; children: number };
  bedType: string;
  area: string;
  amenities: string[];
  highlights: string[];
  smoking: boolean;
  accessibility: boolean;
  cancellationPolicy: string;
}

export const rooms: RoomContent[] = [
  {
    slug: "forest-suite",
    name: "The Forest Suite",
    description:
      "A serene sanctuary nestled amidst lush greenery, offering panoramic views of the surrounding forest. Wake to the sound of birdsong and enjoy your morning tea on the private balcony overlooking the canopy.",
    shortDescription:
      "Panoramic forest views with a private balcony — ideal for nature lovers seeking tranquility.",
    image: "/images/live-7.webp",
    gallery: ROOM_GALLERY,
    maxOccupancy: { adults: 2, children: 1 },
    bedType: "King Bed",
    area: "450 sq ft",
    amenities: [
      "Air Conditioning",
      "Private Balcony",
      "Hot Water",
      "Wi-Fi",
      "Daily Housekeeping",
      "Complimentary Parking",
    ],
    highlights: ["Forest View", "Private Balcony"],
    smoking: false,
    accessibility: false,
    cancellationPolicy: "Free cancellation up to 48 hours before check-in",
  },
  {
    slug: "river-cottage",
    name: "The River Cottage",
    description:
      "A charming cottage with soothing sounds of the Kosi River nearby. The perfect blend of rustic warmth and modern comfort, designed for couples seeking an intimate escape.",
    shortDescription:
      "Rustic riverside charm with modern comforts — perfect for a romantic getaway.",
    image: "/images/accommodation-8.webp",
    gallery: ROOM_GALLERY,
    maxOccupancy: { adults: 2, children: 0 },
    bedType: "Queen Bed",
    area: "380 sq ft",
    amenities: [
      "Air Conditioning",
      "Garden View",
      "Hot Water",
      "Wi-Fi",
      "Daily Housekeeping",
      "Complimentary Parking",
    ],
    highlights: ["River Proximity", "Garden View"],
    smoking: false,
    accessibility: true,
    cancellationPolicy: "Free cancellation up to 48 hours before check-in",
  },
  {
    slug: "family-lodge",
    name: "The Family Lodge",
    description:
      "Spacious and welcoming, the Family Lodge is designed for families who want to share the magic of Corbett together. Two connecting sleeping areas, ample play space, and a warm, safe environment for children.",
    shortDescription:
      "Spacious family-friendly lodge with connecting rooms — designed for shared adventures.",
    image: "/images/accommodation-11.webp",
    gallery: ROOM_GALLERY,
    maxOccupancy: { adults: 3, children: 2 },
    bedType: "2 King Beds",
    area: "650 sq ft",
    amenities: [
      "Air Conditioning",
      "Garden View",
      "Hot Water",
      "Wi-Fi",
      "Daily Housekeeping",
      "Complimentary Parking",
      "Extra Bedding",
    ],
    highlights: ["Family Friendly", "Spacious Layout"],
    smoking: false,
    accessibility: true,
    cancellationPolicy: "Free cancellation up to 48 hours before check-in",
  },
  {
    slug: "jungle-view-room",
    name: "The Jungle View Room",
    description:
      "A comfortable retreat with direct views into the surrounding jungle. Watch deer graze at dawn and listen to the forest come alive at dusk — all from the comfort of your room.",
    shortDescription:
      "Direct jungle views from your window — where wildlife meets comfort.",
    image: "/images/luxury-room-style.webp",
    gallery: ROOM_GALLERY,
    maxOccupancy: { adults: 2, children: 1 },
    bedType: "King Bed",
    area: "420 sq ft",
    amenities: [
      "Air Conditioning",
      "Jungle View",
      "Hot Water",
      "Wi-Fi",
      "Daily Housekeeping",
      "Complimentary Parking",
    ],
    highlights: ["Jungle View", "Wildlife Spotting"],
    smoking: false,
    accessibility: false,
    cancellationPolicy: "Free cancellation up to 48 hours before check-in",
  },
  {
    slug: "garden-suite",
    name: "The Garden Suite",
    description:
      "A ground-floor suite opening directly onto the retreat's landscaped gardens. Perfect for guests who love the outdoors and want easy access to the organic farm and nature trails.",
    shortDescription:
      "Ground-floor suite with direct garden access — ideal for outdoor enthusiasts.",
    image: "/images/outside-shot.webp",
    gallery: ROOM_GALLERY,
    maxOccupancy: { adults: 2, children: 1 },
    bedType: "King Bed",
    area: "440 sq ft",
    amenities: [
      "Air Conditioning",
      "Garden Access",
      "Hot Water",
      "Wi-Fi",
      "Daily Housekeeping",
      "Complimentary Parking",
    ],
    highlights: ["Garden Access", "Ground Floor"],
    smoking: false,
    accessibility: true,
    cancellationPolicy: "Free cancellation up to 48 hours before check-in",
  },
  {
    slug: "canopy-room",
    name: "The Canopy Room",
    description:
      "Perched to offer elevated views of the forest canopy, this room brings you eye-level with the treetops. A unique perspective on the Corbett wilderness, wrapped in quiet luxury.",
    shortDescription:
      "Elevated treetop views with quiet luxury — experience Corbett from above.",
    image: "/images/live-13.webp",
    gallery: ROOM_GALLERY,
    maxOccupancy: { adults: 2, children: 0 },
    bedType: "King Bed",
    area: "400 sq ft",
    amenities: [
      "Air Conditioning",
      "Treetop View",
      "Hot Water",
      "Wi-Fi",
      "Daily Housekeeping",
      "Complimentary Parking",
    ],
    highlights: ["Treetop View", "Elevated Position"],
    smoking: false,
    accessibility: false,
    cancellationPolicy: "Free cancellation up to 48 hours before check-in",
  },
];

export function getRoomBySlug(slug: string): RoomContent | undefined {
  return rooms.find((r) => r.slug === slug);
}
