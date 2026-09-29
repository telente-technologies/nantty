import type { Metadata } from "next";

import { FeaturedWorkspace } from "@/components/catalog/featuredWorkspace";

export const metadata: Metadata = { title: "Mart home" };

export default function MartHomeFeaturesPage() {
  return <FeaturedWorkspace />;
}
