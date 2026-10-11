"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { usePaymentPoll } from "@/components/actions/paymentPoll.hook";
import { PaymentReturnStatus } from "@/components/actions/paymentReturnStatus";
import { Spinner } from "@/components/ui/feedback";
import { paymentsService } from "@/services/payments.service";
import { forgetPendingOrderPayment, pendingSubscriptionStorageKey, readPendingOrderPayment, readPendingValue, type PendingOrderPayment } from "@/utils/paymentReturn.util";

function OrderPaymentReturn({ pending }: { readonly pending: PendingOrderPayment }) {
  const queryClient = useQueryClient();
  const verification = usePaymentPoll({
    queryKey: ["payments", "order", pending.orderId, pending.reference],
    enabled: true,
    fetch: () => paymentsService.fetchPaymentStatus(pending.reference),
    readOutcome: (result) => (result.status === "succeeded" ? "succeeded" : result.status === "failed" || result.status === "cancelled" ? "failed" : "pending"),
  });
  useEffect(() => {
    if (verification.state === "confirming") return;
    forgetPendingOrderPayment();
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
  }, [verification.state, queryClient]);
  return (
    <PaymentReturnStatus
      state={verification.state}
      notice={verification.notice}
      confirmingText="We're checking your payment with our payment partner. This usually takes a few seconds."
      succeededTitle="Payment confirmed"
      succeededText="Your order is on its way to the seller."
      failedText="The payment didn't go through, so the order isn't paid yet. If money left your account, it's returned automatically. You can try again from the order."
      continueHref={`/orders/${encodeURIComponent(pending.orderId)}`}
      continueLabel="View your order"
    />
  );
}

export default function PaymentReturnPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingOrderPayment | null | undefined>(undefined);
  useEffect(() => {
    const subscriptionId = readPendingValue(pendingSubscriptionStorageKey);
    if (subscriptionId) {
      router.replace(`/subscriptions/return?subscriptionId=${encodeURIComponent(subscriptionId)}`);
      return;
    }
    const stored = readPendingOrderPayment();
    if (!stored) router.replace("/orders");
    setPending(stored);
  }, [router]);
  if (!pending) return <Spinner label="Finishing your payment" />;
  return <OrderPaymentReturn pending={pending} />;
}
