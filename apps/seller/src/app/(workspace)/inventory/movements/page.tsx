import type { Metadata } from "next";

import { StockMovementsView } from "@/components/inventory/stockMovementsView";

export const metadata: Metadata = { title: "Stock movements" };

export default function StockMovementsPage() {
  return <StockMovementsView />;
}
