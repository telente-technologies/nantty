import type { Metadata } from "next";

import { AccountSecurityWorkspace } from "@/components/account/accountSecurityWorkspace";

export const metadata: Metadata = { title: "Your security" };

export default function AccountSecurityPage() {
  return <AccountSecurityWorkspace />;
}
