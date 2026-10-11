"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { usePaymentPoll } from "@/components/actions/paymentPoll.hook";
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
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? searchParams.get("tx_ref") ?? "";
  const queryClient = useQueryClient();
  const [returnPath, setReturnPath] = useState("/live");
  useEffect(() => setReturnPath(readStoredReturnPath()), []);
  const confirmation = usePaymentPoll({
    queryKey: ["coins", "purchase", reference],
    enabled: reference.length > 0,
    fetch: () => coinsService.confirmCoinPurchase(reference),
    readOutcome: (result) => (result.status === "pending" ? "pending" : result.status),
  });
  const state = confirmation.state;
  useEffect(() => {
    if (state === "succeeded") void queryClient.invalidateQueries({ queryKey: ["coins", "balance"] });
  }, [state, queryClient]);

  return (
    <PaymentReturnStatus
      state={state}
      notice={confirmation.notice}
      confirmingText="Confirming payment… This usually takes a few seconds."
      succeededTitle="Coins added"
      succeededText={`${confirmation.data?.coins.toLocaleString() ?? ""} coins are in your balance.`}
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
