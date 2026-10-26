"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useCountryRequiredRetry } from "@/components/commerce/countryRequiredDialog";
import { useSession } from "@/components/providers/sessionProvider";
import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { subscriptionOffersService } from "@/services/subscriptionOffers.service";
import type { OfferPreview } from "@/types/subscriptionOffer.type";
import { paymentReturnUrl, pendingOfferTokenStorageKey, rememberPendingValue } from "@/utils/paymentReturn.util";
import { describeBlockedOffer, describeOfferDuration, describeOfferHeadline } from "@/utils/subscriptionOfferCopy.util";

import { OfferPlanChooser, type OfferSelection } from "./offerPlanChooser";
import styles from "./subscriptionOffer.module.css";

const paymentConfirmationPollMs = 3_000;

function firstSelectable(offer: OfferPreview): OfferSelection | null {
  for (const plan of offer.plans.filter((candidate) => candidate.availableForProfile)) {
    const price = plan.prices.find((candidate) => candidate.offerApplies) ?? plan.prices[0];
    if (price) return { planCode: plan.planCode, interval: price.interval };
  }
  return null;
}

function OfferSummary({ offer }: { readonly offer: OfferPreview }) {
  return (
    <header className={styles.summary}>
      <p className={styles.eyebrow}>Nantty offer</p>
      <h1 className={styles.headline}>{describeOfferHeadline(offer)}</h1>
      <dl className={styles.facts}>
        <div><dt>Discount applies to</dt><dd>{describeOfferDuration(offer.durationCycles)}</dd></div>
        <div><dt>Offer ends</dt><dd>{offer.expiresAt ? new Date(offer.expiresAt).toLocaleString() : "No end date"}</dd></div>
      </dl>
    </header>
  );
}

export function SubscriptionOfferView({ token }: { readonly token: string }) {
  const { viewer } = useSession();
  const isReturningFromPayment = useSearchParams().get("step") === "paid";
  const [selection, setSelection] = useState<OfferSelection | null>(null);
  const [activated, setActivated] = useState(false);
  const { retry: countryRetry, dialog: countryDialog } = useCountryRequiredRetry();
  const offerQuery = useQuery({
    queryKey: ["subscriptionOffer", token, viewer?.id ?? "guest"],
    queryFn: () => subscriptionOffersService.fetchOffer(token),
    retry: false,
    refetchInterval: (query) => (isReturningFromPayment && query.state.data?.state !== "claimed_by_you" ? paymentConfirmationPollMs : false),
  });
  const claimAndPay = useMutation({
    mutationFn: async (input: { readonly offer: OfferPreview; readonly choice: OfferSelection }) => {
      const claim = await subscriptionOffersService.claimOffer(token, input.offer.profileId ?? "");
      return subscriptionOffersService.startOfferCheckout({ profileId: input.offer.profileId ?? "", planCode: input.choice.planCode, interval: input.choice.interval, offerClaimId: claim.id, returnTo: paymentReturnUrl() });
    },
    onSuccess: (started) => {
      if (started.activated || !started.authorizationUrl) {
        setActivated(true);
        void offerQuery.refetch();
        return;
      }
      rememberPendingValue(pendingOfferTokenStorageKey, token);
      window.location.assign(started.authorizationUrl);
    },
    onError: (error, input) => {
      countryRetry.handle(error instanceof WebappRequestError ? error.code : null, () => claimAndPay.mutate(input));
      void offerQuery.refetch();
    },
  });

  if (offerQuery.isLoading) return <Spinner label="Opening your offer" />;
  if (offerQuery.isError || !offerQuery.data) {
    const isMissing = offerQuery.error instanceof WebappRequestError && offerQuery.error.status === 404;
    return isMissing ? <EmptyState title="This offer link isn't valid" description="Check that you opened the whole link from your email." /> : <ErrorState description="We couldn't load this offer." error={offerQuery.error} onRetry={() => void offerQuery.refetch()} />;
  }
  const offer = offerQuery.data;
  if (activated || (isReturningFromPayment && offer.state === "claimed_by_you")) {
    return (
      <section className={styles.page}>
        <OfferSummary offer={offer} />
        <EmptyState icon={<AppIcon name="sealCheck20" size={28} />} title="Your offer is active" description="Your plan is on and the discount is applied. You'll get a receipt by email." action={<Link href="/settings">Go to settings</Link>} />
      </section>
    );
  }
  if (isReturningFromPayment) return <Spinner label="Confirming your payment" />;
  const blocked = describeBlockedOffer(offer);
  const choice = selection ?? firstSelectable(offer);
  const nextPath = encodeURIComponent(`/offer/${token}`);
  return (
    <section className={styles.page}>
      <OfferSummary offer={offer} />
      {blocked ? (
        <div className={styles.notice} role="status">
          <h2 className={styles.noticeTitle}>{blocked.title}</h2>
          <p className={styles.noticeText}>{blocked.text}</p>
        </div>
      ) : (
        <>
          <OfferPlanChooser plans={offer.plans} selection={choice} onSelect={setSelection} />
          {viewer ? (
            <Button size="lg" fullWidth busy={claimAndPay.isPending} disabled={!choice} onClick={() => choice && claimAndPay.mutate({ offer, choice })}>
              {offer.state === "reserved_by_you" ? "Continue to payment" : "Claim your offer"}
            </Button>
          ) : (
            <div className={styles.guestActions}>
              <Link className={styles.primaryLink} href={`/login?next=${nextPath}`}>Sign in to claim</Link>
              <Link className={styles.secondaryLink} href={`/signup?next=${nextPath}`}>Create an account</Link>
            </div>
          )}
          {claimAndPay.isError ? <p className={styles.errorText} role="alert">{readErrorMessageForDisplay(claimAndPay.error)}</p> : null}
          <p className={styles.fineprint}>
            You pay on the web; app store purchases can&apos;t take offers. The offer doesn&apos;t combine with other discounts, so you always get the lower price.
            {offer.singleUse ? " This link can be claimed once." : ""}
          </p>
        </>
      )}
      {countryDialog}
    </section>
  );
}
