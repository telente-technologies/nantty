export const topLevelRouteSegments: readonly string[] = [
  "spaces",
  "ads", "analytics", "boost", "cart", "category", "chats", "checkout", "clips", "coins", "collections", "create", "creator", "disputes", "explore", "live", "mart", "me",
  "notifications", "offer", "orders", "p", "pay", "post", "product", "saved", "seller", "settings", "sounds", "stories", "store", "store-rewards", "subscriptions", "u", "user",
  "verification", "verify-email", "videos", "wallet", "watch", "forgot-password", "help", "login", "reset-password", "signup", "welcome", "bff", "api", "sitemap.xml", "sitemaps", "robots.txt", "security-check", "embed", "oembed",
];

const reservedSegments = new Set(topLevelRouteSegments.map((segment) => segment.toLowerCase()));

export function isReservedTopLevelRoute(segment: string): boolean {
  return reservedSegments.has(segment.toLowerCase());
}

export const usernamePathPattern = /^\/[A-Za-z0-9._]{3,30}$/;

export function isUsernameProfilePath(pathname: string): boolean {
  return usernamePathPattern.test(pathname) && !isReservedTopLevelRoute(pathname.slice(1));
}
