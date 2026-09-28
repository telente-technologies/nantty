import type { CategorizedNotification } from "@/types/commerce.type";

import { buildMockUserSummary, isoDateHoursAgo } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

let notifications: CategorizedNotification[] = [
  { id: "n_1", category: "orders", title: "Order shipped", body: "Custom Mechanical Keyboard is on its way.", createdAt: isoDateHoursAgo(1), read: false, actor: null },
  { id: "n_2", category: "social", title: "Freda Dickinson", body: "liked your post.", createdAt: isoDateHoursAgo(3), read: false, actor: buildMockUserSummary(3, "Freda Dickinson") },
  { id: "n_3", category: "social", title: "Carlos Trantow", body: "started following you.", createdAt: isoDateHoursAgo(5), read: true, actor: buildMockUserSummary(4, "Carlos Trantow") },
  { id: "n_4", category: "orders", title: "Payment held in escrow", body: "₦200.00 is held safely until you confirm delivery.", createdAt: isoDateHoursAgo(26), read: true, actor: null },
  { id: "n_5", category: "system", title: "Welcome to Zudomart", body: "Discover real sellers around you.", createdAt: isoDateHoursAgo(72), read: true, actor: null },
];

export const notificationsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/notifications", () => notifications),
  createMockRoute("POST", "/api/v1/notifications/read-all", () => {
    notifications = notifications.map((n) => ({ ...n, read: true }));
  }),
  createMockRoute("POST", "/api/v1/notifications/:notificationId/read", ({ params }) => {
    notifications = notifications.map((n) => (n.id === params.notificationId ? { ...n, read: true } : n));
  }),
];
