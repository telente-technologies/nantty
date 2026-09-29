import type { Metadata } from "next";

import { BrandStoresView } from "@/components/brand/brandStoresView";

export const metadata: Metadata = { title: "Brand stores" };

export default function BrandStoresPage() {
  return <BrandStoresView />;
}
