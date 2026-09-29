import type { Metadata } from "next";

import { AdDetailPage } from "@/components/campaigns/adDetailPage";

export const metadata: Metadata = { title: "Ad" };

export default async function AdDetailRoutePage({ params }: { readonly params: Promise<{ adId: string }> }) {
  const { adId } = await params;
  return <AdDetailPage adId={adId} />;
}
