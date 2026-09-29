import type { Metadata } from "next";

import { BrandDetailWorkspace } from "@/components/brands/brandDetailWorkspace";

export const metadata: Metadata = { title: "Brand" };

export default async function BrandDetailPage({ params }: { readonly params: Promise<{ readonly brandId: string }> }) {
  const { brandId } = await params;
  return <BrandDetailWorkspace brandId={brandId} />;
}
