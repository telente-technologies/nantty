"use client";

import { useIsOnline } from "@nantty/web-kit";
import { useEffect, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/panel";
import { readErrorMessageForDisplay, SellerApiRequestError, sendSellerApiRequest } from "@/services/clientApi.service";
import { isPaymentStillPending, paymentPollIntervalMs, paymentPollTimeoutMs } from "@/utils/paymentPoll.util";

type ConfirmationState = { readonly kind: "checking" } | { readonly kind: "timedOut" } | { readonly kind: "failed"; readonly message: string };

export function SubscriptionPaymentConfirmation({ reference }: { readonly reference: string | null }) {
  const isOnline = useIsOnline();
  const [state, setState] = useState<ConfirmationState>(reference ? { kind: "checking" } : { kind: "failed", message: "This link is missing its payment reference." });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!reference || state.kind !== "checking" || !isOnline) return;
    let cancelled = false;
    const startedAt = Date.now();
    const path = /^(TRL|GLD)_/.test(reference) ? "/seller/subscription/trial/verify" : "/seller/subscription/verify";
    const check = async () => {
      while (!cancelled) {
        try {
          await sendSellerApiRequest(path, { method: "POST", body: { reference } });
          if (!cancelled) window.location.assign("/bff/auth/access-refresh?next=/dashboard");
          return;
        } catch (error) {
          if (cancelled) return;
          if (error instanceof SellerApiRequestError && error.isNetworkFailure && typeof navigator !== "undefined" && !navigator.onLine) return;
          if (!isPaymentStillPending(error)) {
            setState({ kind: "failed", message: readErrorMessageForDisplay(error) });
            return;
          }
          if (Date.now() - startedAt > paymentPollTimeoutMs) {
            setState({ kind: "timedOut" });
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, paymentPollIntervalMs));
        }
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [reference, state.kind, isOnline, attempt]);

  const checkAgain = () => {
    setState({ kind: "checking" });
    setAttempt((value) => value + 1);
  };

  return (
    <>
      <PageHeader title="Confirming your plan payment" description="We check the payment with our payment partner before switching anything on. The page you came back from doesn't decide this." />
      {state.kind === "failed" ? (
        <Callout tone="error" title="We could not confirm this payment" action={<ButtonLink href="/settings/billing">Back to plans</ButtonLink>}>
          {state.message}
        </Callout>
      ) : state.kind === "timedOut" ? (
        <Callout tone="caution" title="Still confirming" action={<Button onClick={checkAgain}>Check again</Button>}>
          Our payment partner hasn&apos;t confirmed this payment yet. You won&apos;t be charged twice. Your plan switches on as soon as it&apos;s confirmed.
        </Callout>
      ) : !isOnline ? (
        <Callout tone="caution" title="You're offline">You&apos;re offline. We&apos;ll check your payment when you&apos;re back online.</Callout>
      ) : (
        <LoadingBlock label="Confirming payment" />
      )}
    </>
  );
}
