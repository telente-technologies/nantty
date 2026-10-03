import type { Metadata } from "next";

import { AccountsWorkspace } from "@/components/people/accounts/accountsWorkspace";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return <AccountsWorkspace />;
}
