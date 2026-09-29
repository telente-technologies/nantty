import type { Metadata } from "next";

import { VerificationQueueWorkspace } from "@/components/people/verificationQueueWorkspace";

export const metadata: Metadata = { title: "Verification reviews" };

export default function VerificationQueuePage() {
  return <VerificationQueueWorkspace />;
}
