import { ApiError } from "@/errors/api.error";
import { useAuthStore } from "@/store/auth.store";
import type { CreatorStatus, LiveSessionDetails, ProductSummary } from "@/types";

import { buildMockProductSummary } from "./commerceFixtures.mock";
import { liveMocks } from "./live.mock";
import { listProductSummariesInStore } from "./productCatalog.mock";
import { createMockRoute, type MockContext, type MockRoute } from "./registry.mock";

const APPROVED_CREATOR_STATUS: CreatorStatus = { status: "approved", canGoLive: true, tier: "rising" };
const NON_CREATOR_STATUS: CreatorStatus = { status: "none", canGoLive: false };

const isSignedInUserAFanAccount = () => {
  const signedInUser = useAuthStore.getState().user;
  const identifiers = [signedInUser?.email, signedInUser?.username];
  return identifiers.some((identifier) => identifier?.toLowerCase().includes("fan"));
};

export const resolveMockCreatorStatusForSignedInUser = (): CreatorStatus =>
  isSignedInUserAFanAccount() ? NON_CREATOR_STATUS : APPROVED_CREATOR_STATUS;

const affiliatedProducts: ProductSummary[] = [
  buildMockProductSummary(301, "Ankara Two-Piece Set", 4_500),
  buildMockProductSummary(302, "Shea Butter Glow Kit", 1_800),
  buildMockProductSummary(303, "Wireless Earbuds Pro", 3_200),
];

const pinnedProductIdByLiveId = new Map<string, string>();

const findOriginalLiveRouteHandler = (method: "GET" | "POST", path: string) =>
  liveMocks.find((route) => route.method === method && route.path === path)?.handler;

const originalFetchLiveSessionHandler = findOriginalLiveRouteHandler("GET", "/api/v1/lives/:liveId");
const originalStartLiveSessionHandler = findOriginalLiveRouteHandler("POST", "/api/v1/lives");

const enrichLiveSessionWithCreatorFeatures = (session: LiveSessionDetails): LiveSessionDetails => {
  const pinnedProductId = pinnedProductIdByLiveId.get(session.id) ?? null;
  const pinnedProduct = session.storeId ? listProductSummariesInStore(session.storeId).find((product) => product.id === pinnedProductId) : undefined;
  const productsWithoutPinned = session.products.filter((product) => product.id !== pinnedProductId);
  return {
    ...session,
    hostIsCreator: true,
    giftsEnabled: true,
    pinnedProductId,
    products: pinnedProduct ? [pinnedProduct, ...productsWithoutPinned] : session.products,
  };
};

const fetchLiveSessionWithCreatorFeatures = (context: MockContext) => {
  if (!originalFetchLiveSessionHandler) throw new ApiError(404, "Live not found");
  return enrichLiveSessionWithCreatorFeatures(originalFetchLiveSessionHandler(context) as LiveSessionDetails);
};

const startLiveSessionOnlyForApprovedCreators = (context: MockContext) => {
  if (!resolveMockCreatorStatusForSignedInUser().canGoLive) {
    throw new ApiError(403, "Join the Creator Program to go live", "CREATOR_PROGRAM_REQUIRED");
  }
  if (!originalStartLiveSessionHandler) throw new ApiError(404, "Live unavailable");
  return enrichLiveSessionWithCreatorFeatures(originalStartLiveSessionHandler(context) as LiveSessionDetails);
};

export const creatorsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/creators/me", () => resolveMockCreatorStatusForSignedInUser()),
  createMockRoute("GET", "/api/v1/creators/me/affiliated-products", () => {
    if (resolveMockCreatorStatusForSignedInUser().status !== "approved") return [];
    return affiliatedProducts;
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/pins", (context) => {
    const { params, body } = context;
    if (resolveMockCreatorStatusForSignedInUser().status !== "approved") throw new ApiError(403, "Only creators can pin products", "NOT_LIVE_HOST");
    const { productId } = body as { productId: string };
    const session = fetchLiveSessionWithCreatorFeatures({ ...context, params: { liveId: params.liveId! } });
    if (!session.storeId) throw new ApiError(422, "Start the live for a store to show products.", "PRODUCTS_REQUIRE_STORE");
    if (!listProductSummariesInStore(session.storeId).some((product) => product.id === productId)) throw new ApiError(403, "That product is not in this store.", "PRODUCT_NOT_IN_STORE");
    pinnedProductIdByLiveId.set(params.liveId!, productId);
  }),
  createMockRoute("GET", "/api/v1/lives/:liveId", fetchLiveSessionWithCreatorFeatures),
  createMockRoute("POST", "/api/v1/lives", startLiveSessionOnlyForApprovedCreators),
];
