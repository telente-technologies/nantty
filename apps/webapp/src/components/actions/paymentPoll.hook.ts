"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useState } from "react";
import { useIsOnline } from "@nantty/web-kit";

import { WebappRequestError } from "@/services/clientApi.service";
import { nextPaymentPollDelay } from "@/utils/paymentPollSchedule.util";

export type PaymentPollOutcome = "pending" | "succeeded" | "failed";

export const paymentPollIntervalMs = 3_000;
export const paymentPollMaxAttempts = 40;

export const paymentPollNotices = {
  offline: "You're offline. We'll check your payment again when you're back online.",
  slow: "This is taking longer than usual. We're still confirming with our payment partner, and you won't be charged twice. You can leave this page; we'll update it once the payment is confirmed.",
} as const;

interface PaymentPollOptions<Result> {
  readonly queryKey: QueryKey;
  readonly enabled: boolean;
  readonly fetch: () => Promise<Result>;
  readonly readOutcome: (result: Result) => PaymentPollOutcome;
}

function isTransientFailure(error: unknown): boolean {
  return error instanceof WebappRequestError ? error.isNetworkFailure || error.status >= 500 : true;
}

export function usePaymentPoll<Result>({ queryKey, enabled, fetch, readOutcome }: PaymentPollOptions<Result>) {
  const isOnline = useIsOnline();
  const [startedAt] = useState(() => Date.now());
  const query = useQuery({
    queryKey,
    queryFn: fetch,
    enabled,
    retry: (failureCount, error) => isTransientFailure(error) && failureCount < 3,
    refetchInterval: (current) =>
      nextPaymentPollDelay(current.state, (result) => readOutcome(result) === "pending", isTransientFailure, paymentPollIntervalMs, paymentPollMaxAttempts),
    refetchIntervalInBackground: false,
  });
  const outcome: PaymentPollOutcome = query.data ? readOutcome(query.data) : "pending";
  const hardFailure = query.isError && !isTransientFailure(query.error);
  const state = !enabled || hardFailure || outcome === "failed" ? "failed" : outcome === "succeeded" ? "succeeded" : "confirming";
  const notice = state !== "confirming" ? null : !isOnline ? paymentPollNotices.offline : query.dataUpdatedAt - startedAt >= paymentPollIntervalMs * (paymentPollMaxAttempts - 2) || query.isError ? paymentPollNotices.slow : null;
  return { data: query.data, state, notice, refetch: query.refetch } as const;
}
