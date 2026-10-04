import type { MetadataRoute } from "next";

import { buildAbsoluteSiteUrl } from "@/utils/seoPaths.util";

const privatePaths = ["/bff/", "/api/", "/me", "/settings", "/saved", "/cart", "/checkout", "/orders", "/chats", "/notifications", "/analytics", "/coins", "/subscriptions", "/store-rewards", "/verify-email", "/creator", "/login", "/signup", "/forgot-password", "/reset-password", "/welcome"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: privatePaths }],
    sitemap: buildAbsoluteSiteUrl("/sitemap.xml"),
    host: buildAbsoluteSiteUrl("/"),
  };
}
