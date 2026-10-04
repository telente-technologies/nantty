export const topLevelRouteSegments: readonly string[] = [
  "analytics", "cart", "category", "chats", "checkout", "clips", "coins", "collections", "creator", "explore", "live", "mart", "me",
  "notifications", "orders", "p", "post", "product", "saved", "settings", "store", "store-rewards", "subscriptions", "u", "user",
  "verify-email", "watch", "forgot-password", "help", "login", "reset-password", "signup", "welcome", "bff", "api", "sitemap.xml", "sitemaps", "robots.txt", "security-check",
];

const reservedSegments = new Set(topLevelRouteSegments.map((segment) => segment.toLowerCase()));

export function isReservedTopLevelRoute(segment: string): boolean {
  return reservedSegments.has(segment.toLowerCase());
}

export const usernamePathPattern = /^\/[A-Za-z0-9._]{3,30}$/;

export function isUsernameProfilePath(pathname: string): boolean {
  return usernamePathPattern.test(pathname) && !isReservedTopLevelRoute(pathname.slice(1));
}
