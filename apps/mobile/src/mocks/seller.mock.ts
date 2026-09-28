import type { SellerApplication, SellerApplicationInput, StoreProduct, StoreProductInput } from "@/types/account.type";
import type { Order, OrderStatus, SellerDashboard } from "@/types";

import { buildMockUserSummary, isoDateHoursAgo } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const store = { id: "s_1", name: "Usershop Name", logoUrl: null, rating: 3.4, ratingCount: 200, reviewCount: 103 };

const buildStoreOrder = (index: number, status: OrderStatus): Order => ({
  id: `o_${index}`,
  reference: `ZM10${40 + index}`,
  status,
  items: [
    { id: `ci_${index}`, product: { id: "pr_kb", name: "Custom Mechanical Keyboard", price: 20_000, imageUrl: null }, quantity: 1, variant: null },
  ],
  total: 20_000,
  buyer: { ...buildMockUserSummary(index, "Enyo Dev") },
  store,
  createdAt: isoDateHoursAgo(index * 5 + 1),
  escrowReleaseAt: null,
});

let orders: Order[] = [buildStoreOrder(1, "pending"), buildStoreOrder(2, "shipped"), buildStoreOrder(3, "delivered")];

let products: StoreProduct[] = [
  { id: "sp_1", name: "Product Name", price: 20_000, imageUrl: null, stock: 12, description: "", sizes: [], colors: [], imageUrls: [], published: true },
  { id: "sp_2", name: "Product Name", price: 20_000, imageUrl: null, stock: 3, description: "", sizes: [], colors: [], imageUrls: [], published: true },
];

let application: SellerApplication | null = null;

const HOURS = ["12 AM", "3 PM", "6 PM", "9 PM", "12 PM", "3 AM"];

const dashboard = (): SellerDashboard => ({
  totalSales: 20_000,
  orders: 1,
  series: HOURS.flatMap((label, i) => [
    { label, value: 0 },
    { label: `${label}+`, value: i === 0 ? 1 : 0 },
  ]),
  recentOrders: orders.slice(0, 3),
  inventory: products,
});

const toStoreProduct = (id: string, input: StoreProductInput, published = true): StoreProduct => ({
  ...input,
  id,
  imageUrl: input.imageUrls[0] ?? null,
  published,
});

export const sellerMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/seller/dashboard", () => dashboard()),
  createMockRoute("GET", "/api/v1/seller/applications/me", () => application),
  createMockRoute("POST", "/api/v1/seller/applications", ({ body }) => {
    application = { ...(body as SellerApplicationInput), id: "sa_1", status: "pending", submittedAt: new Date().toISOString() };
    return application;
  }),
  createMockRoute("GET", "/api/v1/seller/products", () => products),
  createMockRoute("GET", "/api/v1/seller/products/:productId", ({ params }) => products.find((p) => p.id === params.productId)),
  createMockRoute("POST", "/api/v1/seller/products", ({ body }) => {
    const product = toStoreProduct(`sp_${Date.now()}`, body as StoreProductInput);
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
  createMockRoute("GET", "/api/v1/seller/orders", () => orders),
  createMockRoute("GET", "/api/v1/seller/orders/:orderId", ({ params }) => orders.find((o) => o.id === params.orderId)),
  createMockRoute("POST", "/api/v1/seller/orders/:orderId/ship", ({ params }) => {
    orders = orders.map((o) => (o.id === params.orderId ? { ...o, status: "shipped" } : o));
    return orders.find((o) => o.id === params.orderId);
  }),
];
