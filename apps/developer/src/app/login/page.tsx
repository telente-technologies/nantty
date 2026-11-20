import type { Metadata } from "next";

import { DeveloperLoginWorkspace } from "@/components/developerLoginWorkspace";
import { PublicDocsShell } from "@/components/publicDocsShell";

export const metadata: Metadata = {
  title: "Sign in & OTP verification",
  description: "Sign in to Nantty Developers via PKCE S256 SSO and verify your identity with a 6-digit email OTP or password.",
};

export default function DeveloperLoginPage() {
  return (
    <PublicDocsShell>
      <DeveloperLoginWorkspace />
    </PublicDocsShell>
  );
}
