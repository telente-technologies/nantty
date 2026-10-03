import type { Metadata } from "next";

import { FlashSalesView } from "@/components/marketing/flashSalesView";

export const metadata: Metadata = { title: "Flash sales" };

export default function MarketingFlashSalesPage() {
  return <FlashSalesView />;
}
