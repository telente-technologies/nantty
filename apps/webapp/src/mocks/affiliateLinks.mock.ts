import { ApiError } from "@/errors/api.error";

import { createMockRoute, type MockRoute } from "./registry.mock";

const linkedProducts: Record<string, string> = { link_dress: "prod_1" };

export const affiliateLinkMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/affiliate-links/:linkId/clicks", ({ params }) => {
    const productId = linkedProducts[params.linkId ?? ""];
    if (!productId) throw new ApiError(404, "This link doesn't exist.", "LINK_NOT_FOUND");
    return { productId, attribution: { source: "link", id: params.linkId }, attributionWindowDays: 30, expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString() };
  }),
];
