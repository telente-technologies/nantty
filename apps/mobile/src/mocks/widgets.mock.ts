import type { CreatorTodayWidgetPayload, LiveNowWidgetPayload, OrderWidgetPayload, SellerTodayWidgetPayload, StoriesWidgetPayload } from "@/types/widget.type";

import { avatarImageUrlForUser } from "./mockImages.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const amountsHidden = (query: URLSearchParams) => query.get("amounts") === "hidden";

const ordersWidget = (): OrderWidgetPayload => ({
  orders: [
    { id: "o_1042", reference: "ZM-1042", status: "out_for_delivery", statusLabel: "Out for delivery", etaAt: hoursFromNow(3), itemTitle: "Adire two-piece set", itemCount: 1, imageUrl: null, storeName: "Adaeze Styles", deepLink: "zudomart://orders/o_1042" },
    { id: "o_1038", reference: "ZM-1038", status: "preparing", statusLabel: "Being prepared", etaAt: hoursFromNow(50), itemTitle: "Shea butter glow kit", itemCount: 2, imageUrl: null, storeName: "Glow by Zainab", deepLink: "zudomart://orders/o_1038" },
  ],
  activeCount: 2,
  generatedAt: new Date().toISOString(),
});

const sellerTodayWidget = (hidden: boolean): SellerTodayWidgetPayload => ({
  storeName: "Temi Homes", salesToday: hidden ? null : { amountMinor: 18_450_000, currency: "NGN" }, ordersToday: 7, ordersToShip: 4,
  availableBalance: hidden ? null : { amountMinor: 92_300_000, currency: "NGN" }, amountsHidden: hidden, deepLink: "zudomart://seller/dashboard", generatedAt: new Date().toISOString(),
});

const liveNowWidget = (): LiveNowWidgetPayload => ({
  lives: [
    { id: "live_ada", hostId: "u_1", hostName: "Adaeze Okafor", hostUsername: "adaeze.styles", hostAvatarUrl: avatarImageUrlForUser("u_1"), title: "New adire drop, live try-on", viewers: 1840, deepLink: "zudomart://live/live_ada" },
    { id: "live_tunde", hostId: "u_2", hostName: "Tunde Bakare", hostUsername: "tundetech", hostAvatarUrl: avatarImageUrlForUser("u_2"), title: "Unboxing the new phones", viewers: 620, deepLink: "zudomart://live/live_tunde" },
  ],
  generatedAt: new Date().toISOString(),
});

const creatorTodayWidget = (hidden: boolean): CreatorTodayWidgetPayload => ({
  creatorProgramMember: true, viewsToday: 12_480, newFollowersToday: 86, earningsToday: hidden ? null : { amountMinor: 2_150_000, currency: "NGN" }, amountsHidden: hidden,
  deepLink: "zudomart://creator/dashboard", generatedAt: new Date().toISOString(),
});

const storiesWidget = (): StoriesWidgetPayload => ({
  people: (["u_1", "u_3", "u_2"] as const).map((key, index) => ({
    userId: key, name: ["Adaeze Okafor", "Zainab Bello", "Tunde Bakare"][index] ?? key, username: ["adaeze.styles", "glowbyzainab", "tundetech"][index] ?? key,
    avatarUrl: avatarImageUrlForUser(key), hasUnseen: index < 2, storyCount: 3 - index, latestStoryAt: hoursFromNow(-(index + 1)), thumbnailUrl: null, deepLink: `zudomart://stories/${key}`,
  })),
  generatedAt: new Date().toISOString(),
});

export const widgetsMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/auth/widget-token", () => ({ widgetToken: "mock-widget-token", expiresIn: 86_400, scope: "widgets:read" })),
  createMockRoute("DELETE", "/api/v1/auth/widget-token", () => undefined),
  createMockRoute("POST", "/api/v1/auth/realtime-token", () => ({ realtimeToken: "mock-realtime-token", expiresIn: 90, scope: "realtime" })),
  createMockRoute("POST", "/api/v1/notifications/device-tokens", () => undefined),
  createMockRoute("DELETE", "/api/v1/notifications/device-tokens", () => undefined),
  createMockRoute("GET", "/api/v1/widgets/orders", ordersWidget),
  createMockRoute("GET", "/api/v1/widgets/seller-today", ({ query }) => sellerTodayWidget(amountsHidden(query))),
  createMockRoute("GET", "/api/v1/widgets/live-now", liveNowWidget),
  createMockRoute("GET", "/api/v1/widgets/creator-today", ({ query }) => creatorTodayWidget(amountsHidden(query))),
  createMockRoute("GET", "/api/v1/widgets/stories", storiesWidget),
];
