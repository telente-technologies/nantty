"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { PaymentReturnStatus } from "@/components/actions/paymentReturnStatus";
import { creatorSubscriptionsService } from "@/services/webActions.service";
import { forgetPendingValue, pendingSubscriptionStorageKey, readPendingValue } from "@/utils/paymentReturn.util";

function SubscriptionReturn() {
  const subscriptionId = useSearchParams().get("subscriptionId") ?? "";
  useEffect(() => {
    if (subscriptionId && readPendingValue(pendingSubscriptionStorageKey) === subscriptionId) forgetPendingValue(pendingSubscriptionStorageKey);
  }, [subscriptionId]);
  const stateQuery = useQuery({
    queryKey: ["subscriptions", subscriptionId],
    queryFn: () => creatorSubscriptionsService.fetchSubscriptionState(subscriptionId),
    enabled: subscriptionId.length > 0,
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 3_000 : false),
  });
  const status = stateQuery.data?.status;
  const state = !subscriptionId || stateQuery.isError || status === "failed" || status === "cancelled" ? "failed" : status === "active" ? "succeeded" : "confirming";
  return (
    <PaymentReturnStatus
      state={state}
      confirmingText="Confirming payment…"
      succeededTitle="You're subscribed"
      succeededText={stateQuery.data?.renewsAt ? `Renews on ${new Date(stateQuery.data.renewsAt).toLocaleDateString()}.` : "Subscriber-only posts, clips and lives are now unlocked."}
      failedText="The subscription wasn't completed. You haven't been charged for a failed attempt."
      continueHref="/"
      continueLabel="Back to your feed"
    />
  );
}

export default function SubscriptionReturnPage() {
  return (
    <Suspense fallback={null}>
      <SubscriptionReturn />
    </Suspense>
  );
}
