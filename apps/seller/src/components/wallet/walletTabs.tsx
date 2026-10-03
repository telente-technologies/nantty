"use client";

import { LinkTabs } from "@/components/ui/navigationTabs";

export function WalletTabs() {
  return (
    <LinkTabs
      label="Payments and finance sections"
      tabs={[
        { href: "/wallet", label: "Overview", exact: true },
        { href: "/wallet/escrow", label: "Escrow" },
        { href: "/wallet/settlements", label: "Settlements" },
        { href: "/wallet/fees", label: "Fees" },
        { href: "/wallet/refunds", label: "Refunds" },
        { href: "/wallet/withdraw", label: "Withdraw & payouts" },
        { href: "/wallet/statements", label: "Statements" },
        { href: "/wallet/accounts", label: "Payout accounts" },
      ]}
    />
  );
}
