import type { MetadataRoute } from "next";

import { readPublicSiteUrl } from "@/config/siteMetadata.config";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = readPublicSiteUrl();
  const lastModified = new Date();
  return ["/", "/policy"].map((path) => ({
    url: new URL(path, baseUrl).toString(),
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
