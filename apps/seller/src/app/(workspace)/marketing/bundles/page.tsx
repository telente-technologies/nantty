import type { Metadata } from "next";

import { ProductBundlesView } from "@/components/marketing/productBundlesView";

export const metadata: Metadata = { title: "Bundles" };

export default function MarketingBundlesPage() {
  return <ProductBundlesView />;
}
