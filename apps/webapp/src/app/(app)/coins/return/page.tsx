"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { PaymentReturnStatus } from "@/components/actions/paymentReturnStatus";
import { coinPurchaseReturnPathStorageKey } from "@/components/live/coinPurchaseDialog";
import { coinsService } from "@/services/webActions.service";
import { readSafeRelativeRedirectPath } from "@/utils/safeRedirectPath.util";

function readStoredReturnPath(): string {
  try {
    return readSafeRelativeRedirectPath(window.sessionStorage.getItem(coinPurchaseReturnPathStorageKey), "/live");
  } catch {
    return "/live";
  }
}

function CoinPurchaseReturn() {
  const reference = useSearchParams().get("reference") ?? "";
  const queryClient = useQueryClient();
  const [returnPath, setReturnPath] = useState("/live");
  useEffect(() => setReturnPath(readStoredReturnPath()), []);
  const confirmationQuery = useQuery({
    queryKey: ["coins", "purchase", reference],
    queryFn: () => coinsService.confirmCoinPurchase(reference),
    enabled: reference.length > 0,
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 3_000 : false),
  });
  const status = confirmationQuery.data?.status;
  useEffect(() => {
    if (status === "succeeded") void queryClient.invalidateQueries({ queryKey: ["coins", "balance"] });
  }, [status, queryClient]);

  const state = !reference || confirmationQuery.isError || status === "failed" ? "failed" : status === "succeeded" ? "succeeded" : "confirming";
  return (
    <PaymentReturnStatus
      state={state}
      confirmingText="Confirming payment… This usually takes a few seconds."
      succeededTitle="Coins added"
      succeededText={`${confirmationQuery.data?.coins.toLocaleString() ?? ""} coins are in your balance.`}
      failedText="We couldn't confirm this purchase. If you were charged, the coins will appear once the payment is confirmed."
      continueHref={returnPath}
      continueLabel="Back to the live"
    />
  );
}

export default function CoinPurchaseReturnPage() {
  return (
    <Suspense fallback={null}>
      <CoinPurchaseReturn />
    </Suspense>
  );
}
