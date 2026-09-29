import type { Metadata } from "next";

import { AdSetDetailPage } from "@/components/campaigns/adSetDetailPage";

export const metadata: Metadata = { title: "Ad set" };

export default async function AdSetDetailRoutePage({ params }: { readonly params: Promise<{ adSetId: string }> }) {
  const { adSetId } = await params;
  return <AdSetDetailPage adSetId={adSetId} />;
}
