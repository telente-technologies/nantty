import type { Metadata } from "next";

import { PromotionsListView } from "@/components/promotions/promotionsListView";

export const metadata: Metadata = { title: "Promotions" };

export default function PromotionsPage() {
  return <PromotionsListView />;
}
