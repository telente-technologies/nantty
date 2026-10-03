import type { Metadata } from "next";

import { OrderInvoiceView } from "@/components/orders/orderInvoiceView";

export const metadata: Metadata = { title: "Invoice" };

export default async function OrderInvoicePage({ params, searchParams }: { readonly params: Promise<{ orderId: string }>; readonly searchParams: Promise<{ document?: string }> }) {
  const { orderId } = await params;
  const { document } = await searchParams;
  return <OrderInvoiceView orderId={orderId} documentKind={document === "receipt" ? "receipt" : "invoice"} />;
}
