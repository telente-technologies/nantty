"use client";

import { useSearchParams } from "next/navigation";
import { useIsOnline } from "@zudomart/web-kit";
import { useEffect, useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { InlineNotice, LoadingBlock } from "@/components/ui/feedback";
import { Card } from "@/components/ui/surfaces";
import { billingApi } from "@/services/billingApi.service";
import { AdsApiRequestError, readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { TopUp } from "@/types/billing.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./billingPage.module.css";

const pollIntervalMs = 3_000;
const pollTimeoutMs = 120_000;

function useTopUpVerificationByReference(accountId: string, reference: string | null, onSucceeded: () => void) {
  const isOnline = useIsOnline();
  const [topUp, setTopUp] = useState<TopUp | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasGivenUp, setHasGivenUp] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!reference || !/^[A-Za-z0-9_-]{4,64}$/.test(reference) || !isOnline || hasGivenUp) return;
    let isCancelled = false;
    const startedAt = Date.now();
    async function checkPaymentStatusUntilSettled() {
      try {
        const latest = await billingApi.fetchTopUpByReference(accountId, reference as string);
        if (isCancelled) return;
        setTopUp(latest);
        setErrorMessage(null);
        if (latest.status === "succeeded") onSucceeded();
        if (latest.status !== "pending") return;
      } catch (error) {
        if (isCancelled) return;
        if (!(error instanceof AdsApiRequestError && error.status === 0)) {
          setErrorMessage(readErrorMessageForDisplay(error));
          return;
        }
      }
      if (Date.now() - startedAt >= pollTimeoutMs) setHasGivenUp(true);
      else setTimeout(() => void (isCancelled ? undefined : checkPaymentStatusUntilSettled()), pollIntervalMs);
    }
    void checkPaymentStatusUntilSettled();
    return () => {
      isCancelled = true;
    };
  }, [accountId, reference, onSucceeded, isOnline, hasGivenUp, round]);
  const checkAgain = () => {
    setHasGivenUp(false);
    setRound((value) => value + 1);
  };
  return { topUp, errorMessage, hasGivenUp, isOnline, checkAgain };
}

export function BillingReturnPage() {
  const { accountId, buildAccountPagePath, reloadAccount } = useAdAccount();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? searchParams.get("trxref") ?? searchParams.get("tx_ref");
  const cardReference = searchParams.get("cardReference");
  const { topUp, errorMessage, hasGivenUp, isOnline, checkAgain } = useTopUpVerificationByReference(accountId, reference, reloadAccount);
  const backLink = (
    <ButtonLink href={buildAccountPagePath("/billing")} variant="primary">
      Back to billing
    </ButtonLink>
  );

  let content;
  if (cardReference && !reference) {
    content = <InlineNotice tone="success" title="Card added">Your card is saved and can pay for delivery. Choose it as the default in billing if you want.</InlineNotice>;
  } else if (!reference) {
    content = <InlineNotice tone="caution" title="No payment to check">This page is opened after a payment. Start a top-up from billing.</InlineNotice>;
  } else if (errorMessage) {
    content = <InlineNotice tone="error" title="We could not check this payment">{errorMessage}</InlineNotice>;
  } else if (!topUp || topUp.status === "pending") {
    content = hasGivenUp ? (
      <>
        <InlineNotice tone="caution" title="Still confirming">Our payment partner has not confirmed payment {reference} yet. It will show in your transactions once it does. You won&apos;t be charged twice.</InlineNotice>
        <div><Button onClick={checkAgain}>Check again</Button></div>
      </>
    ) : !isOnline ? (
      <InlineNotice tone="caution" title="You're offline">You&apos;re offline. We&apos;ll check your payment when you&apos;re back online.</InlineNotice>
    ) : (
      <>
        <LoadingBlock label="Confirming your payment" height={64} />
        <p className={styles.muted}>Confirming payment {reference} with our payment partner. The page you came back from doesn&apos;t decide this.</p>
      </>
    );
  } else if (topUp.status === "succeeded") {
    content = <InlineNotice tone="success" title={`${formatMoneyForDisplay(topUp.amount)} added`}>The funds are in your balance and ads can deliver now. Reference {topUp.reference}.</InlineNotice>;
  } else {
    content = (
      <InlineNotice tone="error" title={topUp.status === "abandoned" ? "Payment cancelled" : "Payment failed"}>
        {topUp.failureReason ?? "No money was taken. You can try again from billing."}
      </InlineNotice>
    );
  }

  return (
    <div className={styles.returnPanel}>
      <Card title="Payment status">
        <div className={styles.stack} style={{ alignItems: "stretch", textAlign: "left" }}>
          {content}
          <div>{backLink}</div>
        </div>
      </Card>
    </div>
  );
}
