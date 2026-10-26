"use client";

import { useQuery } from "@tanstack/react-query";
import { OfficialStoreBadges } from "@nantty/web-kit";

import styles from "@/components/escrow/escrow.module.css";
import { storeLinks } from "@/config/brandContact.config";
import { sendRequestToWebappServer } from "@/services/clientApi.service";
import type { PayoutOnboardingSummary } from "@/types/payoutOnboarding.type";
import { describePayoutSetupCard, type PayoutSetupCardContext } from "@/utils/payoutSetupCard.util";

export function PayoutSetupCard({ context }: { readonly context?: PayoutSetupCardContext }) {
  const state = useQuery({
    queryKey: ["payouts", "onboarding"],
    queryFn: () => sendRequestToWebappServer<PayoutOnboardingSummary>("/api/v1/payments/payout-onboarding/me"),
    retry: false,
    staleTime: 60_000,
  });
  const card = describePayoutSetupCard(state.data, context);
  if (!card) return null;
  return (
    <section className={styles.notice} aria-labelledby="payout-setup-title">
      <h2 id="payout-setup-title" className={styles.noticeTitle}>{card.title}</h2>
      <p className={styles.muted}>{card.body}</p>
      <p className={styles.muted}><strong>{card.actionLabel} in the Nantty app.</strong> Payout setup checks your ID with our payment partner, so it&apos;s only available in the app for now.</p>
      <OfficialStoreBadges links={storeLinks} />
    </section>
  );
}
