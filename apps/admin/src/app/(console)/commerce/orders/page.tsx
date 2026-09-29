import type { Metadata } from "next";

import { OrdersWorkspace } from "@/components/money/ordersWorkspace";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return <OrdersWorkspace />;
}
