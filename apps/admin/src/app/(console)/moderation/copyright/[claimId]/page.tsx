import type { Metadata } from "next";

import { CopyrightClaimDetailWorkspace } from "@/components/trust/copyrightClaimDetailWorkspace";

export const metadata: Metadata = { title: "Copyright claim" };

export default async function CopyrightClaimPage({ params }: { readonly params: Promise<{ readonly claimId: string }> }) {
  const { claimId } = await params;
  return <CopyrightClaimDetailWorkspace claimId={claimId} />;
}
