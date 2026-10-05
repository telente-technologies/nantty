"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConsentToggleRow } from "@/components/settings/consentToggleRow";
import { RetryButton } from "@/components/ui/controls";
import { ErrorState } from "@/components/ui/feedback";
import { currentPolicyVersion } from "@/config/legalLinks.config";
import { privacyService } from "@/services/privacy.service";
import type { ConsentKey, ConsentRecord } from "@/types/privacy.type";

import styles from "./settings.module.css";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";

const consentOptions: readonly { readonly key: ConsentKey; readonly label: string; readonly description: string }[] = [
  { key: "personalization", label: "Personalization", description: "Use what you view, search and buy to tailor your feed and recommendations." },
  { key: "personalizedAds", label: "Personalized ads", description: "Show ads based on your activity. Turning this off still shows ads, just less relevant." },
  { key: "analytics", label: "Analytics", description: "Share anonymous usage data so we can fix problems and improve Zudomart." },
  { key: "marketing", label: "Marketing messages", description: "Receive offers, news and product updates by email and push." },
];

const consentsQueryKey = ["privacy", "consents"] as const;

export function ConsentChoicesSection() {
  const queryClient = useQueryClient();
  const consentsQuery = useQuery({ queryKey: consentsQueryKey, queryFn: privacyService.fetchMyConsents });
  const updateConsent = useMutation({
    mutationFn: ({ key, enabled }: { key: ConsentKey; enabled: boolean }) => privacyService.updateMyConsents({ policyVersion: currentPolicyVersion, consents: { [key]: enabled } }),
    onMutate: async ({ key, enabled }) => {
      await queryClient.cancelQueries({ queryKey: consentsQueryKey });
      const previous = queryClient.getQueryData<ConsentRecord>(consentsQueryKey);
      if (previous) queryClient.setQueryData(consentsQueryKey, { ...previous, consents: { ...previous.consents, [key]: enabled } });
      return { previous };
    },
    onError: (_error, _input, context) => context?.previous && queryClient.setQueryData(consentsQueryKey, context.previous),
    onSuccess: (record) => queryClient.setQueryData(consentsQueryKey, record),
  });

  return (
    <section className={styles.block} aria-labelledby="privacy-choices-heading">
      <h2 id="privacy-choices-heading" className={styles.blockHeading}>Your choices</h2>
      {consentsQuery.isLoading ? <ListRowsSkeleton label="Loading your privacy choices" rows={4} withAvatar={false} /> : null}
      {consentsQuery.isError ? <ErrorState description="We couldn't load your privacy choices." action={<RetryButton onRetry={() => consentsQuery.refetch()} />} /> : null}
      {consentsQuery.data ? consentOptions.map((option) => <ConsentToggleRow key={option.key} label={option.label} description={option.description} enabled={consentsQuery.data.consents[option.key]} onChange={(enabled) => updateConsent.mutate({ key: option.key, enabled })} />) : null}
      {updateConsent.isError ? <p className={styles.errorText} role="alert">We couldn&apos;t save that choice. Try again.</p> : null}
    </section>
  );
}
