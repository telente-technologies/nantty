import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/siteConfig.config";

const publicRoutes: ReadonlyArray<{ readonly path: string; readonly priority: number; readonly changeFrequency: "weekly" | "monthly" | "yearly" }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/sellers", priority: 0.9, changeFrequency: "weekly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { path: "/waitlist", priority: 0.8, changeFrequency: "weekly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/cookies", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/community-guidelines", priority: 0.3, changeFrequency: "yearly" },
  { path: "/seller-terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/creator-terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/ads-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/refund-escrow-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/copyright-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/data-rights", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return publicRoutes.map((publicRoute) => ({
    url: new URL(publicRoute.path, siteConfig.siteUrl).toString(),
    lastModified,
    changeFrequency: publicRoute.changeFrequency,
    priority: publicRoute.priority,
  }));
}
