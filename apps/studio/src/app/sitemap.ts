import type { MetadataRoute } from "next";

import { readPublicSiteUrl } from "@/config/studioEnvironment.config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: new URL("/", readPublicSiteUrl()).toString(),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1,
  }];
}
