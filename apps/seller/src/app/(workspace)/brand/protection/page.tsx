import type { Metadata } from "next";

import { BrandProtectionView } from "@/components/brand/brandProtectionView";

export const metadata: Metadata = { title: "Brand protection" };

export default function BrandProtectionPage() {
  return <BrandProtectionView />;
}
