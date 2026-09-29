import type { Metadata } from "next";

import { IpClaimDetailWorkspace } from "@/components/brands/ipClaimDetailWorkspace";

export const metadata: Metadata = { title: "Trademark claim" };

export default async function IpClaimDetailPage({ params }: { readonly params: Promise<{ readonly claimId: string }> }) {
  const { claimId } = await params;
  return <IpClaimDetailWorkspace claimId={claimId} />;
}
