import type { PostLocationTag } from "@/types";

import { createMockRoute, type MockRoute } from "./registry.mock";

const MOCK_PLACES: readonly PostLocationTag[] = [
  { placeId: "zm:ng:lagos:lekki", name: "Lekki", area: "Lagos, Nigeria" },
  { placeId: "zm:ng:lagos:yaba", name: "Yaba", area: "Lagos, Nigeria" },
  { placeId: "zm:ng:lagos:ikeja", name: "Ikeja", area: "Lagos, Nigeria" },
  { placeId: "zm:ng:lagos:lagos", name: "Lagos", area: "Nigeria" },
  { placeId: "zm:ng:fct:abuja", name: "Abuja", area: "FCT, Nigeria" },
  { placeId: "zm:ng:oyo:ibadan", name: "Ibadan", area: "Oyo, Nigeria" },
  { placeId: "zm:gh:greater-accra:accra", name: "Accra", area: "Greater Accra, Ghana" },
  { placeId: "zm:gh:ashanti:kumasi", name: "Kumasi", area: "Ashanti, Ghana" },
  { placeId: "zm:ke:nairobi:nairobi", name: "Nairobi", area: "Kenya" },
  { placeId: "zm:za:western-cape:cape-town", name: "Cape Town", area: "Western Cape, South Africa" },
  { placeId: "zm:za:gauteng:johannesburg", name: "Johannesburg", area: "Gauteng, South Africa" },
];

const normalise = (text: string) => text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const placesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/places/search", ({ query }) => {
    const typed = (query.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    const term = normalise(typed);
    if (term.length < 2) return { places: [] };
    const places = MOCK_PLACES.filter((place) => normalise(`${place.name} ${place.area ?? ""}`).split(" ").some((word) => word.startsWith(term)) || normalise(place.name).startsWith(term)).slice(0, 15);
    const listed = places.some((place) => normalise(place.name) === term);
    return { places: listed ? places : [...places, { placeId: `text:${term.replace(/ /g, "-")}`, name: typed, area: null }] };
  }),
];
