import type { SellerApplication, SellerApplicationInput, StoreProduct, StoreProductInput } from "@/types/account.type";
import type { Order, OrderStatus, SellerDashboard } from "@/types";

import { buildMockUserSummary, isoDateHoursAgo } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const KEYBOARD_PRICE_IN_USD_CENTS = 1_300;
const store = { id: "s_1", name: "Usershop Name", logoUrl: null, rating: 3.4, ratingCount: 200, reviewCount: 103 };

const buildStoreOrder = (index: number, status: OrderStatus): Order => ({
  id: `o_${index}`,
  reference: `ZM10${40 + index}`,
  status,
  items: [
    {
      id: `ci_${index}`,
      product: { id: "pr_kb", name: "Custom Mechanical Keyboard", price: convertUsdCentsToViewerCurrency(KEYBOARD_PRICE_IN_USD_CENTS), imageUrl: null },
      quantity: 1,
      variant: null,
    },
  ],
  total: convertUsdCentsToViewerCurrency(KEYBOARD_PRICE_IN_USD_CENTS),
  buyer: buildMockUserSummary(index, "Enyo Dev"),
  store,
  createdAt: isoDateHoursAgo(index * 5 + 1),
  escrowReleaseAt: null,
});

const orderStatuses = new Map<string, OrderStatus>([
  ["o_1", "pending"],
  ["o_2", "shipped"],
  ["o_3", "delivered"],
]);

const listStoreOrders = () => [...orderStatuses].map(([id, status]) => buildStoreOrder(Number(id.slice(2)), status));

let products: StoreProduct[] = [
  { id: "sp_1", name: "Product Name", price: convertUsdCentsToViewerCurrency(KEYBOARD_PRICE_IN_USD_CENTS), imageUrl: null, stock: 12, description: "", sizes: [], colors: [], imageUrls: [], published: true },
  { id: "sp_2", name: "Product Name", price: convertUsdCentsToViewerCurrency(KEYBOARD_PRICE_IN_USD_CENTS), imageUrl: null, stock: 3, description: "", sizes: [], colors: [], imageUrls: [], published: true },
];

const productsInViewerCurrency = () =>
  products.map((p) => (p.id.startsWith("sp_") && p.id.length === 4 ? { ...p, price: convertUsdCentsToViewerCurrency(KEYBOARD_PRICE_IN_USD_CENTS) } : p));

let application: SellerApplication | null = null;

const HOURS = ["12 AM", "3 PM", "6 PM", "9 PM", "12 PM", "3 AM"];

const buildSellerDashboard = (): SellerDashboard => ({
  totalSales: convertUsdCentsToViewerCurrency(KEYBOARD_PRICE_IN_USD_CENTS),
  orders: 1,
  series: HOURS.flatMap((label, i) => [
    { label, value: 0 },
    { label: `${label}+`, value: i === 0 ? 1 : 0 },
  ]),
  recentOrders: listStoreOrders(),
  inventory: productsInViewerCurrency(),
});

const toStoreProduct = (id: string, input: StoreProductInput, published = true): StoreProduct => ({
  ...input,
  id,
  imageUrl: input.imageUrls[0] ?? null,
  published,
});

export const sellerMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/seller/dashboard", () => buildSellerDashboard()),
  createMockRoute("GET", "/api/v1/seller/applications/me", () => application),
  createMockRoute("POST", "/api/v1/seller/applications", ({ body }) => {
    application = { ...(body as SellerApplicationInput), id: "sa_1", status: "pending", submittedAt: new Date().toISOString() };
    return application;
  }),
  createMockRoute("GET", "/api/v1/seller/products", () => productsInViewerCurrency()),
  createMockRoute("GET", "/api/v1/seller/products/:productId", ({ params }) => productsInViewerCurrency().find((p) => p.id === params.productId)),
  createMockRoute("POST", "/api/v1/seller/products", ({ body }) => {
    const product = toStoreProduct(`sp_new_${Date.now()}`, body as StoreProductInput);
    products = [product, ...products];
    return product;
  }),
  createMockRoute("PATCH", "/api/v1/seller/products/:productId", ({ params, body }) => {
    products = products.map((p) => (p.id === params.productId ? toStoreProduct(p.id, body as StoreProductInput, p.published) : p));
    return products.find((p) => p.id === params.productId);
  }),
  createMockRoute("DELETE", "/api/v1/seller/products/:productId", ({ params }) => {
    products = products.filter((p) => p.id !== params.productId);
  }),
  createMockRoute("GET", "/api/v1/seller/orders", () => listStoreOrders()),
  createMockRoute("GET", "/api/v1/seller/orders/:orderId", ({ params }) => listStoreOrders().find((o) => o.id === params.orderId)),
  createMockRoute("POST", "/api/v1/seller/orders/:orderId/ship", ({ params }) => {
    if (orderStatuses.has(params.orderId!)) orderStatuses.set(params.orderId!, "shipped");
    return listStoreOrders().find((o) => o.id === params.orderId);
  }),
];
