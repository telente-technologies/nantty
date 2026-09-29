import type { Metadata } from "next";

import { BrandOfficialStoreView } from "@/components/brand/brandOfficialStoreView";

export const metadata: Metadata = { title: "Official Store" };

export default function BrandOfficialStorePage() {
  return <BrandOfficialStoreView />;
}
