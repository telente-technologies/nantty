import type { Metadata } from "next";

import { VerificationDetailWorkspace } from "@/components/people/verificationDetailWorkspace";

export const metadata: Metadata = { title: "Verification review" };

export default async function VerificationDetailPage({ params }: { readonly params: Promise<{ readonly verificationId: string }> }) {
  const { verificationId } = await params;
  return <VerificationDetailWorkspace verificationId={verificationId} />;
}
