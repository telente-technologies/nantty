import type { Metadata } from "next";

import { OrdersListView } from "@/components/orders/ordersListView";
import type { OnlineOrderStatus } from "@/types/order.type";

export const metadata: Metadata = { title: "Orders" };

const onlineOrderStatuses: OnlineOrderStatus[] = ["new", "processing", "ready", "shipped", "delivered", "completed", "cancelled", "returned", "refunded", "disputed"];

export default async function OrdersPage({ searchParams }: { readonly searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const initialStatusFilter = onlineOrderStatuses.find((candidate) => candidate === status) ?? "all";
  return <OrdersListView initialStatusFilter={initialStatusFilter} />;
}
