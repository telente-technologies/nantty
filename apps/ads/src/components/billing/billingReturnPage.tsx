"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { ButtonLink } from "@/components/ui/button";
import { InlineNotice, LoadingBlock } from "@/components/ui/feedback";
import { Card } from "@/components/ui/surfaces";
import { billingApi } from "@/services/billingApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { TopUp } from "@/types/billing.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

import styles from "./billingPage.module.css";

const maximumVerificationAttempts = 10;

function useTopUpVerificationByReference(accountId: string, reference: string | null, onSucceeded: () => void) {
  const [topUp, setTopUp] = useState<TopUp | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasGivenUp, setHasGivenUp] = useState(false);
  useEffect(() => {
    if (!reference || !/^[A-Za-z0-9_-]{4,64}$/.test(reference)) return;
    let isCancelled = false;
    let attempt = 0;
    async function checkPaymentStatusUntilSettled() {
      attempt += 1;
      try {
        const latest = await billingApi.fetchTopUpByReference(accountId, reference as string);
        if (isCancelled) return;
        setTopUp(latest);
        if (latest.status === "succeeded") onSucceeded();
        if (latest.status !== "pending") return;
      } catch (error) {
        if (isCancelled) return;
        setErrorMessage(readErrorMessageForDisplay(error));
        return;
      }
      if (attempt >= maximumVerificationAttempts) setHasGivenUp(true);
      else setTimeout(checkPaymentStatusUntilSettled, 2500);
    }
    void checkPaymentStatusUntilSettled();
    return () => {
      isCancelled = true;
    };
  }, [accountId, reference, onSucceeded]);
  return { topUp, errorMessage, hasGivenUp };
}

export function BillingReturnPage() {
  const { accountId, buildAccountPagePath, reloadAccount } = useAdAccount();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const cardReference = searchParams.get("cardReference");
  const { topUp, errorMessage, hasGivenUp } = useTopUpVerificationByReference(accountId, reference, reloadAccount);
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
      <InlineNotice tone="caution" title="Still confirming">The provider has not confirmed payment {reference} yet. It will show in your transactions once it does. You were not charged twice.</InlineNotice>
    ) : (
      <>
        <LoadingBlock label="Confirming your payment" height={64} />
        <p className={styles.muted}>Confirming payment {reference} with the provider…</p>
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
