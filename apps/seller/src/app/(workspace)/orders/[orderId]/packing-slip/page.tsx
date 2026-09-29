import type { Metadata } from "next";

import { PackingSlipView } from "@/components/orders/packingSlipView";

export const metadata: Metadata = { title: "Packing slip" };

export default async function PackingSlipPage({ params }: { readonly params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <PackingSlipView orderId={orderId} />;
}
