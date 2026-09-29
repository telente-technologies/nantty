import type { Metadata } from "next";

import { StockTransfersView } from "@/components/inventory/stockTransfersView";

export const metadata: Metadata = { title: "Stock transfers" };

export default function StockTransfersPage() {
  return <StockTransfersView />;
}
