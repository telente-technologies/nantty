import type { Metadata } from "next";

import { CoinsWorkspace } from "@/components/money/coinsWorkspace";

export const metadata: Metadata = { title: "Coins" };

export default function CoinsPage() {
  return <CoinsWorkspace />;
}
