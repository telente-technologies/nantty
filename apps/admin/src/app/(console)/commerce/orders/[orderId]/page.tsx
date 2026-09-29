import type { Metadata } from "next";

import { OrderDetailWorkspace } from "@/components/money/orderDetailWorkspace";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({ params }: { readonly params: Promise<{ readonly orderId: string }> }) {
  const { orderId } = await params;
  return <OrderDetailWorkspace orderId={decodeURIComponent(orderId)} />;
}
