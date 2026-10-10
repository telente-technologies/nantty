import { ApiError } from "@/errors/api.error";

import { describeVariant, mockCartState, summariseMockCart } from "./commerceFixtures.mock";
import { findSignedInAddress } from "./settings.mock";
import { findCatalogSeedByProductId } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

interface AddToCartBody {
  readonly productId: string;
  readonly quantity: number;
  readonly size?: string | null;
  readonly color?: string | null;
  readonly variants?: Record<string, string> | null;
  readonly options?: Record<string, string> | null;
}

export const cartMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/cart", () => summariseMockCart()),
  createMockRoute("POST", "/api/v1/cart/shipping-quote", ({ body }) => {
    const address = findSignedInAddress((body as { addressId: string }).addressId);
    if (!address) throw new ApiError(404, "Address not found");
    return summariseMockCart({ countryId: address.countryId, stateId: address.stateId, lgaId: address.lgaId, cityId: address.cityId }, address.id);
  }),
  createMockRoute("POST", "/api/v1/cart/items", ({ body }) => {
    const { productId, quantity, size, color, variants, options } = body as AddToCartBody;
    if (!findCatalogSeedByProductId(productId)) throw new ApiError(404, "This product is no longer available");
    const variant = describeVariant(size, color, variants ?? options);
    const existing = mockCartState.lines.find((line) => line.productId === productId && line.variant === variant);
    mockCartState.lines = existing
      ? mockCartState.lines.map((line) => (line === existing ? { ...line, quantity: line.quantity + quantity } : line))
      : [...mockCartState.lines, { id: `ci_${Date.now()}`, productId, quantity, variant }];
    return summariseMockCart();
  }),
  createMockRoute("PATCH", "/api/v1/cart/items/:itemId", ({ params, body }) => {
    const { quantity } = body as { quantity: number };
    if (quantity < 1) throw new ApiError(400, "Quantity must be at least 1");
    mockCartState.lines = mockCartState.lines.map((line) => (line.id === params.itemId ? { ...line, quantity } : line));
    return summariseMockCart();
  }),
  createMockRoute("DELETE", "/api/v1/cart/items/:itemId", ({ params }) => {
    mockCartState.lines = mockCartState.lines.filter((line) => line.id !== params.itemId);
    return summariseMockCart();
  }),
];
