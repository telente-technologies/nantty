import type { Metadata } from "next";

import { IdentityChecksWorkspace } from "@/components/people/identityChecksWorkspace";

export const metadata: Metadata = { title: "Identity checks" };

export default function IdentityChecksPage() {
  return <IdentityChecksWorkspace />;
}
