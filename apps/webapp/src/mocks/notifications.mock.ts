import type { CategorizedNotification } from "@/types/commerce.type";

import { isoDateHoursAgo, signedInUserIsTheDemoSeller } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { userSummaryById } from "./userDirectory.mock";

const buyerNotifications: CategorizedNotification[] = [
  { id: "n_1", category: "orders", title: "Your order is on its way", body: "Glow by Zainab shipped Vitamin C Glow Serum with GIG Logistics.", createdAt: isoDateHoursAgo(20), read: false, actor: null },
  { id: "n_2", category: "orders", title: "Delivered — please confirm", body: "Did your Over-Ear Noise Cancelling Headphones arrive okay? Confirm receipt so TundeTech gets paid.", createdAt: isoDateHoursAgo(29), read: false, actor: null },
  { id: "n_3", category: "social", title: "Adaeze Okafor", body: "posted a new drop: The Owambe Edit.", createdAt: isoDateHoursAgo(6), read: false, actor: userSummaryById("u_1") },
  { id: "n_4", category: "social", title: "Bisola Ogunleye", body: "and 12 others liked your post.", createdAt: isoDateHoursAgo(8), read: true, actor: userSummaryById("u_10") },
  { id: "n_5", category: "orders", title: "Payment held in escrow", body: "Your payment for Stone-Free Ofada Rice is safe. Mama Nkechi Foods is preparing your order.", createdAt: isoDateHoursAgo(5), read: true, actor: null },
  { id: "n_6", category: "orders", title: "Dispute update", body: "Nantty support replied about your Classic White Low-Top Sneakers order.", createdAt: isoDateHoursAgo(70), read: true, actor: userSummaryById("u_25") },
  { id: "n_7", category: "social", title: "Chinedu Okeke", body: "started following you.", createdAt: isoDateHoursAgo(30), read: true, actor: userSummaryById("u_7") },
  { id: "n_8", category: "system", title: "Welcome to Nantty", body: "Buy from real sellers near you — your money stays in escrow until you confirm delivery.", createdAt: isoDateHoursAgo(900), read: true, actor: null },
];

const sellerNotifications: CategorizedNotification[] = [
  { id: "n_s1", category: "orders", title: "New order — ship within 3 days", body: "Bisola Ogunleye bought Traditional Clay Cooking Pot. Funds are held in escrow.", createdAt: isoDateHoursAgo(3), read: false, actor: userSummaryById("u_10") },
  { id: "n_s2", category: "orders", title: "New order — ship within 3 days", body: "Chinedu Okeke bought 2 × Stoneware Coffee Mug Set.", createdAt: isoDateHoursAgo(9), read: false, actor: userSummaryById("u_7") },
  { id: "n_s3", category: "orders", title: "Dispute opened", body: "Hauwa Musa reported a damaged Scented Soy Candle. Respond within 48 hours.", createdAt: isoDateHoursAgo(20), read: false, actor: userSummaryById("u_19") },
  { id: "n_s4", category: "orders", title: "Escrow released", body: "Payment for order ZM-45203 is now in your available balance.", createdAt: isoDateHoursAgo(240), read: true, actor: null },
  { id: "n_s5", category: "social", title: "Amaka Chukwu", body: "shared your Scented Soy Candle with her followers.", createdAt: isoDateHoursAgo(52), read: true, actor: userSummaryById("u_13") },
];

let readNotificationIds = new Set<string>();

const listSignedInNotifications = () =>
  [...(signedInUserIsTheDemoSeller() ? sellerNotifications : []), ...buyerNotifications]
    .map((notification) => ({ ...notification, read: notification.read || readNotificationIds.has(notification.id) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const notificationsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/notifications", () => listSignedInNotifications()),
  createMockRoute("POST", "/api/v1/notifications/read-all", () => {
    readNotificationIds = new Set(listSignedInNotifications().map((notification) => notification.id));
  }),
  createMockRoute("POST", "/api/v1/notifications/:notificationId/read", ({ params }) => {
    readNotificationIds = new Set([...readNotificationIds, params.notificationId!]);
  }),
];
