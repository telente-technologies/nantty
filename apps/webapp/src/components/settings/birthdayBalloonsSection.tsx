"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { celebrationsQueryKey, useViewerCelebrationsQuery } from "@/components/celebrations/useSurfaceCelebration.hook";
import { showToast } from "@/components/ui/toast";
import { celebrationsService } from "@/services/celebrations.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";

import { ConsentToggleRow } from "./consentToggleRow";
import styles from "./settings.module.css";

export function BirthdayBalloonsSection() {
  const queryClient = useQueryClient();
  const query = useViewerCelebrationsQuery(true);
  const update = useMutation({
    mutationFn: (birthdayBalloonsVisible: boolean) => celebrationsService.updateSettings({ birthdayBalloonsVisible }),
    onSuccess: (next) => queryClient.setQueryData(celebrationsQueryKey, next),
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });
  if (!query.data) return null;
  return (
    <section aria-labelledby="birthday-balloons-heading" className={styles.block}>
      <h2 id="birthday-balloons-heading" className={styles.blockHeading}>Celebrations</h2>
      <ConsentToggleRow
        label="Birthday balloons"
        description="Show balloons on your profile to visitors on your birthday. Your age and date of birth are never shown to others."
        enabled={update.variables ?? query.data.birthdayBalloonsVisible}
        disabled={update.isPending}
        onChange={(enabled) => update.mutate(enabled)}
      />
    </section>
  );
}
