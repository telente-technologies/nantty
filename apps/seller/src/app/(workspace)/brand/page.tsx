import type { Metadata } from "next";

import { BrandProfileView } from "@/components/brand/brandProfileView";

export const metadata: Metadata = { title: "Brand" };

export default function BrandProfilePage() {
  return <BrandProfileView />;
}
