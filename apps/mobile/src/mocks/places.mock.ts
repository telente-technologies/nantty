import type { PostLocationTag } from "@/types";

import { createMockRoute, type MockRoute } from "./registry.mock";

const MOCK_PLACES: readonly PostLocationTag[] = [
  { placeId: "plc_lekki_phase1", name: "Lekki Phase 1", area: "Lagos, Nigeria" },
  { placeId: "plc_yaba", name: "Yaba", area: "Lagos, Nigeria" },
  { placeId: "plc_balogun_market", name: "Balogun Market", area: "Lagos Island, Nigeria" },
  { placeId: "plc_ikeja_city_mall", name: "Ikeja City Mall", area: "Ikeja, Lagos" },
  { placeId: "plc_wuse2", name: "Wuse 2", area: "Abuja, Nigeria" },
  { placeId: "plc_jabi_lake", name: "Jabi Lake Mall", area: "Abuja, Nigeria" },
  { placeId: "plc_osu_oxford", name: "Oxford Street, Osu", area: "Accra, Ghana" },
  { placeId: "plc_kumasi_kejetia", name: "Kejetia Market", area: "Kumasi, Ghana" },
  { placeId: "plc_westlands", name: "Westlands", area: "Nairobi, Kenya" },
  { placeId: "plc_ph_gra", name: "GRA Phase 2", area: "Port Harcourt, Nigeria" },
];

export const findMockPlaceById = (placeId: string) => MOCK_PLACES.find((place) => place.placeId === placeId) ?? null;

export const placesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/places/search", ({ query }) => {
    const text = (query.get("q") ?? "").trim().toLowerCase();
    if (text.length < 2) return { places: [] };
    const places = MOCK_PLACES.filter((place) => `${place.name} ${place.area ?? ""}`.toLowerCase().includes(text)).slice(0, 8);
    const typedName = (query.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    const alreadyListed = places.some((place) => place.name.toLowerCase() === typedName.toLowerCase());
    const freeText: PostLocationTag = { placeId: `text:${typedName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: typedName, area: null };
    return { places: alreadyListed ? places : [...places, freeText] };
  }),
];
