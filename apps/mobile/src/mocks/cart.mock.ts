import { ApiError } from "@/errors/api.error";

import { buildMockProductDetail, mockCartState, summariseMockCart } from "./commerceFixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

export const cartMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/cart", () => summariseMockCart()),
  createMockRoute("POST", "/api/v1/cart/items", ({ body }) => {
    const { productId, quantity } = body as { productId: string; quantity: number };
    const existing = mockCartState.items.find((item) => item.product.id === productId);
    if (existing) {
      mockCartState.items = mockCartState.items.map((item) => (item === existing ? { ...item, quantity: item.quantity + quantity } : item));
    } else {
      const product = buildMockProductDetail(productId);
      mockCartState.items = [...mockCartState.items, { id: `ci_${Date.now()}`, product, quantity, variant: null }];
    }
    return summariseMockCart();
  }),
  createMockRoute("PATCH", "/api/v1/cart/items/:itemId", ({ params, body }) => {
    const { quantity } = body as { quantity: number };
    if (quantity < 1) throw new ApiError(400, "Quantity must be at least 1");
    mockCartState.items = mockCartState.items.map((item) => (item.id === params.itemId ? { ...item, quantity } : item));
    return summariseMockCart();
  }),
  createMockRoute("DELETE", "/api/v1/cart/items/:itemId", ({ params }) => {
    mockCartState.items = mockCartState.items.filter((item) => item.id !== params.itemId);
    return summariseMockCart();
  }),
];
