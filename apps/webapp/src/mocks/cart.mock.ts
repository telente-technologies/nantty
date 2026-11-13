import { ApiError } from "@/errors/api.error";

import { describeVariant, mockCartState, MOCK_SHIPPING_QUOTE_REVISION, mockStoreCreditBalanceUsdCentsByStore, summariseMockCart } from "./commerceFixtures.mock";
import { findSignedInAddress } from "./settings.mock";
import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { quoteSellerShipping } from "./shippingEngine.mock";
import { groupCartItemsByStore } from "@/utils/groupCartItemsByStore.util";
import { findCatalogSeedByProductId } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

interface AddToCartBody {
  readonly productId: string;
  readonly quantity: number;
  readonly size?: string | null;
  readonly color?: string | null;
}

export const cartMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/cart", () => summariseMockCart()),
  createMockRoute("POST", "/api/v1/cart/shipping-quote", ({ body }) => {
    const address = findSignedInAddress((body as { addressId: string }).addressId);
    if (!address) throw new ApiError(404, "Address not found");
    const cart = summariseMockCart();
    const destination = { countryId: address.countryId, stateId: address.stateId, lgaId: address.lgaId, cityId: address.cityId };
    const groups = groupCartItemsByStore(cart.items).map((group) => quoteSellerShipping(group.storeId, group.subtotal, destination));
    const reachable = new Set(groups.filter((group) => group.status === "calculated").map((group) => group.storeId));
    const shippedItems = cart.items.filter((item) => reachable.has(item.store?.id ?? "unknown"));
    const sum = (amounts: readonly number[]) => amounts.reduce((total, amount) => total + amount, 0);
    const shipping = { ...cart.shipping, amountMinor: sum(groups.map((group) => group.fee?.amountMinor ?? 0)) };
    const itemsMinor = sum(shippedItems.map((item) => item.product.price.amountMinor * item.quantity));
    const storeCredit = {
      ...cart.storeCredit,
      amountMinor: groupCartItemsByStore(shippedItems).reduce((total, group) => {
        const credit = convertUsdCentsToViewerCurrency(mockStoreCreditBalanceUsdCentsByStore[group.storeId] ?? 0);
        return total + Math.min(group.subtotal.amountMinor, credit.amountMinor);
      }, 0),
    };
    const wireGroups = groups.map(({ storeId, ...quote }) => ({ storeId, shipping: quote }));
    return { ...cart, addressId: address.id, shippingQuoteRevision: MOCK_SHIPPING_QUOTE_REVISION, groups: wireGroups, itemsTotal: { ...cart.itemsTotal, amountMinor: itemsMinor }, storeCredit, shipping, total: { ...cart.total, amountMinor: itemsMinor - storeCredit.amountMinor + shipping.amountMinor } };
  }),
  createMockRoute("POST", "/api/v1/cart/items", ({ body }) => {
    const { productId, quantity, size, color } = body as AddToCartBody;
    if (!findCatalogSeedByProductId(productId)) throw new ApiError(404, "This product is no longer available");
    const variant = describeVariant(size, color);
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
