"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Spinner } from "@/components/ui/feedback";
import { pendingOrderPaymentStorageKey, pendingSubscriptionStorageKey, readPendingValue } from "@/utils/paymentReturn.util";

function readPendingOrderId(): string | null {
  const raw = readPendingValue(pendingOrderPaymentStorageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { readonly orderId?: unknown };
    return typeof parsed.orderId === "string" ? parsed.orderId : null;
  } catch {
    return null;
  }
}

export default function PaymentReturnPage() {
  const router = useRouter();
  useEffect(() => {
    const subscriptionId = readPendingValue(pendingSubscriptionStorageKey);
    if (subscriptionId) {
      router.replace(`/subscriptions/return?subscriptionId=${encodeURIComponent(subscriptionId)}`);
      return;
    }
    const orderId = readPendingOrderId();
    router.replace(orderId ? `/orders/${encodeURIComponent(orderId)}` : "/orders");
  }, [router]);
  return <Spinner label="Finishing your payment" />;
}
