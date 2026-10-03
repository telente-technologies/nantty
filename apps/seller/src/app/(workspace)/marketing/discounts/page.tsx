import type { Metadata } from "next";

import { PromotionsListView } from "@/components/promotions/promotionsListView";

export const metadata: Metadata = { title: "Discount codes & product discounts" };

export default function MarketingDiscountsPage() {
  return <PromotionsListView />;
}
