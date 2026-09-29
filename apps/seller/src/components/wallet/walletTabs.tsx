"use client";

import { LinkTabs } from "@/components/ui/navigationTabs";

export function WalletTabs() {
  return (
    <LinkTabs
      label="Wallet sections"
      tabs={[
        { href: "/wallet", label: "Overview", exact: true },
        { href: "/wallet/withdraw", label: "Withdraw" },
        { href: "/wallet/accounts", label: "Payout accounts" },
      ]}
    />
  );
}
