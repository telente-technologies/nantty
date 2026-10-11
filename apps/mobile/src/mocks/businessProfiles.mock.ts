import { ApiError } from "@/errors/api.error";
import type { ActingProfile } from "@/types/brand.type";
import type { BusinessCategory, BusinessProfileInput } from "@/types/socialGraph.type";

import { createMockRoute, type MockRoute } from "./registry.mock";
import { checkAvailability } from "./username.mock";
import { assertMockCanCreate } from "./linkedProfiles.mock";

const category = (id: string, parentId: string | null, name: string): BusinessCategory => ({
  id,
  parentId,
  kind: "business",
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  active: true,
});

const BUSINESS_CATEGORIES: readonly BusinessCategory[] = [
  category("bc_media", null, "Media & publishing"),
  category("bc_media_news", "bc_media", "News"),
  category("bc_media_podcast", "bc_media", "Podcast"),
  category("bc_ngo", null, "Non-profit"),
  category("bc_ngo_education", "bc_ngo", "Education"),
  category("bc_ngo_health", "bc_ngo", "Health"),
  category("bc_venue", null, "Venues & events"),
  category("bc_venue_restaurant", "bc_venue", "Restaurant"),
  category("bc_venue_hotel", "bc_venue", "Hotel"),
  category("bc_services", null, "Professional services"),
  category("bc_services_legal", "bc_services", "Legal"),
  category("bc_services_logistics", "bc_services", "Logistics"),
  category("bc_brand", null, "Brand"),
  category("bc_brand_fashion", "bc_brand", "Fashion"),
  category("bc_brand_beauty", "bc_brand", "Beauty"),
];

export const mockBusinessProfiles: ActingProfile[] = [];

export const businessProfilesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/business-categories", () => ({ data: BUSINESS_CATEGORIES, nextCursor: null })),
  createMockRoute("POST", "/api/v1/users/me/business-profiles", ({ body }) => {
    const input = body as BusinessProfileInput;
    const handle = input.handle.trim().toLowerCase();
    if (input.displayName.trim().length < 2) throw new ApiError(422, "Add your business name");
    if (input.categories.length === 0) throw new ApiError(422, "Pick at least one category");
    assertMockCanCreate(input.purpose === "store" ? "store" : "business");
    const availability = checkAvailability(handle);
    if (!availability.available || mockBusinessProfiles.some((profile) => profile.handle === handle)) throw new ApiError(409, "That handle isn't available");
    const profile: ActingProfile = { kind: "business", id: `bp_${Date.now()}`, name: input.displayName.trim(), handle, avatarUrl: null, verification: null };
    mockBusinessProfiles.push(profile);
    return profile;
  }),
];
