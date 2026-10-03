import type { Metadata } from "next";

import { FeaturedProductsView } from "@/components/marketing/featuredProductsView";

export const metadata: Metadata = { title: "Featured products" };

export default function MarketingFeaturedPage() {
  return <FeaturedProductsView />;
}
