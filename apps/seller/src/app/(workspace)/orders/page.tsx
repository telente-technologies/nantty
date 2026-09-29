import type { Metadata } from "next";

import { OrdersListView } from "@/components/orders/ordersListView";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return <OrdersListView />;
}
