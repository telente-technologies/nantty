import type { Metadata } from "next";

import { OrderDetailView } from "@/components/orders/orderDetailView";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({ params }: { readonly params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderDetailView orderId={orderId} />;
}
