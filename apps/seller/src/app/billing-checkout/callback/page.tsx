import type { Metadata } from "next";

import { SubscriptionPaymentConfirmation } from "@/components/billing/subscriptionPaymentConfirmation";

export const metadata: Metadata = { title: "Confirming payment" };

export default async function SubscriptionPaymentCallbackPage({ searchParams }: { readonly searchParams: Promise<{ reference?: string; trxref?: string; tx_ref?: string }> }) {
  const parameters = await searchParams;
  const reference = parameters.reference ?? parameters.trxref ?? parameters.tx_ref ?? "";
  return <SubscriptionPaymentConfirmation reference={/^[A-Za-z0-9_-]{6,100}$/.test(reference) ? reference : null} />;
}
