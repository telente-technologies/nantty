import type { Metadata } from "next";

import { IdentityCheckDetailWorkspace } from "@/components/people/identityCheckDetailWorkspace";

export const metadata: Metadata = { title: "Identity check" };

export default async function IdentityCheckPage({ params }: { readonly params: Promise<{ readonly caseId: string }> }) {
  const { caseId } = await params;
  return <IdentityCheckDetailWorkspace caseId={caseId} />;
}
