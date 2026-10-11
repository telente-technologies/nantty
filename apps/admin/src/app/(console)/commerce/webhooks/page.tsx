import type { Metadata } from "next";

import { PaymentWebhooksWorkspace } from "@/components/money/paymentWebhooksWorkspace";

export const metadata: Metadata = { title: "Payment webhooks" };

export default function PaymentWebhooksPage() {
  return <PaymentWebhooksWorkspace />;
}
