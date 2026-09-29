import type { Metadata } from "next";

import { WalletOverviewView } from "@/components/wallet/walletOverviewView";

export const metadata: Metadata = { title: "Wallet & payouts" };

export default function WalletPage() {
  return <WalletOverviewView />;
}
