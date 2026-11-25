"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { privacyService } from "@/services/privacy.service";
import type { BusinessMessagingConsent } from "@/services/privacy.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";

import styles from "./settings.module.css";

const queryKey = ["privacy", "businessMessagingConsents"] as const;

export function ConnectedBusinessAppsSection() {
  const queryClient = useQueryClient();
  const consents = useQuery({ queryKey, queryFn: privacyService.fetchBusinessMessagingConsents, retry: false });
  const revoke = useMutation({
    mutationFn: privacyService.revokeBusinessMessagingConsent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      showToast({ text: "Business app access revoked" });
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });

  async function confirmRevoke(consent: BusinessMessagingConsent) {
    const confirmed = await requestConfirmation({
      title: `Revoke ${consent.applicationName}?`,
      description: "This app will no longer be authorized to use the messaging permissions you granted. This does not delete your Nantty conversations.",
      confirmLabel: "Revoke access",
    });
    if (confirmed) revoke.mutate(consent.id);
  }

  return (
    <section className={styles.block} aria-labelledby="connected-business-apps-heading">
      <h2 id="connected-business-apps-heading" className={styles.blockHeading}>Connected business apps</h2>
      <p className={styles.muted}>Review and revoke messaging access you granted to approved Nantty business integrations.</p>
      {consents.isPending ? <ListRowsSkeleton label="Loading connected business apps" rows={2} withAvatar={false} /> : null}
      {consents.isError ? <ErrorState description="We couldn't load connected business apps." error={consents.error} onRetry={() => void consents.refetch()} /> : null}
      {consents.data?.length === 0 ? <p className={styles.muted}>You have not authorized any business messaging apps.</p> : null}
      {consents.data?.map((consent) => (
        <article key={consent.id} className={styles.notificationCategory} aria-label={`${consent.applicationName} access`}>
          <div>
            <h3 className={styles.subHeading}>{consent.applicationName}</h3>
            <p className={styles.muted}>{consent.organizationName} · {consent.status === "active" ? "Access active" : "Access revoked"}</p>
            <p className={styles.muted}>Permissions: {consent.scopes.join(", ")}</p>
            <p className={styles.muted}>Granted {new Date(consent.grantedAt).toLocaleDateString()}</p>
          </div>
          {consent.status === "active" ? <div className={styles.buttonRow}><Button variant="danger" busy={revoke.isPending && revoke.variables === consent.id} disabled={revoke.isPending} onClick={() => void confirmRevoke(consent)}>Revoke access</Button></div> : null}
        </article>
      ))}
    </section>
  );
}
