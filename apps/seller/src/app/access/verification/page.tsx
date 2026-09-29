import type { Metadata } from "next";

import { VerificationStatusView } from "@/components/billing/verificationStatusView";

export const metadata: Metadata = { title: "Verification" };

export default function VerificationGatePage() {
  return <VerificationStatusView />;
}
