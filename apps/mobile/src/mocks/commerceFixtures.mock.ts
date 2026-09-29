import type { Cart, CartItem, Order, OrderStatus, Product, ProductSummary, StoreSummary } from "@/types";
import { multiplyMoneyByQuantity } from "@/utils/formatMoney.util";

import { convertUsdCentsToViewerCurrency } from "./locale.mock";

import { buildMockUserSummary, isoDateHoursAgo } from "./fixtures.mock";

export const mockStore: StoreSummary = { id: "s_1", name: "Usershop Name", logoUrl: null, rating: 3.4, ratingCount: 200, reviewCount: 103 };

export const buildMockProductSummary = (index: number, name = "Product Name", usdCents = 20_000): ProductSummary => ({
  id: `p_${index}`,
  name,
  get price() {
    return convertUsdCentsToViewerCurrency(usdCents);
  },
  imageUrl: null,
  liked: false,
  stock: index % 4 === 1 ? 3 : 12,
});

export const mockProductCatalogue: ProductSummary[] = Array.from({ length: 40 }, (_, i) => buildMockProductSummary(i + 1));

export const buildMockProductDetail = (productId: string): Product => {
  const summary = mockProductCatalogue.find((p) => p.id === productId) ?? buildMockProductSummary(1);
  return {
    ...summary,
    images: [],
    title: "A product card title for a product that will  be here. A product card title for a product",
    rating: 2.4,
    promo: "New customer deal * Free Shipping",
    sizes: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10"],
    colors: ["Black", "White", "Blue"],
    shippingInfo:
      "Figma ipsum component variant main layer. Group export vector mask Figma ipsum component variant main layer. Group export vector mask Figma ipsum component variant main layer.",
    description:
      "Figma ipsum component variant main layer. Group export vector mask Figma ipsum component variant main layer. Group export vector mask Figma ipsum component variant main layer.",
    store: mockStore,
    related: mockProductCatalogue.slice(0, 8),
  };
};

const keyboard = (index: number): ProductSummary => buildMockProductSummary(100 + index, "Custom Mechanical Keyboard", 20_000);

export const mockCartState: { items: CartItem[] } = {
  items: [0, 1, 2].map((i) => ({ id: `ci_${i}`, product: keyboard(i), quantity: 2, variant: null })),
};

export const summariseMockCart = (): Cart => {
  const zero = convertUsdCentsToViewerCurrency(0);
  const itemsTotal = mockCartState.items.reduce(
    (sum, item) => ({ ...sum, amountMinor: sum.amountMinor + multiplyMoneyByQuantity(item.product.price, item.quantity).amountMinor }),
    zero,
  );
  return { items: mockCartState.items, itemsTotal, shopDiscount: zero, shipping: zero, total: itemsTotal };
};

const buildMockOrder = (index: number, status: OrderStatus, hours: number): Order => ({
  id: `o_${index}`,
  reference: `ZM-${String(1040 + index)}`,
  status,
  items: [{ id: `oi_${index}`, product: keyboard(index), quantity: 1, variant: null }],
  get total() {
    return convertUsdCentsToViewerCurrency(20_000);
  },
  buyer: buildMockUserSummary(2, "Enyo Dev"),
  store: mockStore,
  createdAt: isoDateHoursAgo(hours),
  escrowReleaseAt: status === "delivered" ? isoDateHoursAgo(-24 * 7) : null,
});

export const mockOrdersState: { orders: Order[] } = {
  orders: [buildMockOrder(1, "pending", 2), buildMockOrder(2, "shipped", 30), buildMockOrder(3, "delivered", 80)],
};
