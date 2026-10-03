"use client";

import { useEffect, useRef, useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/panel";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";

export function SubscriptionPaymentConfirmation({ reference }: { readonly reference: string | null }) {
  const [errorMessage, setErrorMessage] = useState<string | null>(reference ? null : "This link is missing its payment reference.");
  const hasStartedVerification = useRef(false);

  useEffect(() => {
    if (!reference || hasStartedVerification.current) return;
    hasStartedVerification.current = true;
    sendSellerApiRequest("/seller/subscription/verify", { method: "POST", body: { reference } })
      .then(() => window.location.assign("/bff/auth/access-refresh?next=/dashboard"))
      .catch((error: unknown) => setErrorMessage(readErrorMessageForDisplay(error)));
  }, [reference]);

  return (
    <>
      <PageHeader title="Confirming your plan payment" description="We check the payment with our payment partner before switching anything on." />
      {errorMessage ? (
        <Callout tone="error" title="We could not confirm this payment" action={<ButtonLink href="/settings/billing">Back to plans</ButtonLink>}>
          {errorMessage}
        </Callout>
      ) : (
        <LoadingBlock label="Confirming payment" />
      )}
    </>
  );
}
