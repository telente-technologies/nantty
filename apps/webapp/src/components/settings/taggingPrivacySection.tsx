"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { privacyService } from "@/services/privacy.service";

import styles from "./settings.module.css";

const taggingSettingsQueryKey = ["privacy", "tagging-settings"] as const;

export function TaggingPrivacySection() {
  const queryClient = useQueryClient();
  const taggingQuery = useQuery({
    queryKey: taggingSettingsQueryKey,
    queryFn: privacyService.fetchMyTaggingSettings,
    retry: false,
  });
  const updateMutation = useMutation({
    mutationFn: (allowTagging: boolean) => privacyService.updateMyTaggingSettings(allowTagging),
    onMutate: (allowTagging) => queryClient.setQueryData(taggingSettingsQueryKey, { allowTagging }),
    onSuccess: (saved) => {
      queryClient.setQueryData(taggingSettingsQueryKey, saved);
      showToast({ text: "Tagging setting saved" });
    },
    onError: (error) => {
      showToast({ text: readErrorMessageForDisplay(error), tone: "error" });
      void queryClient.invalidateQueries({ queryKey: taggingSettingsQueryKey });
    },
  });

  const allowTagging = taggingQuery.data?.allowTagging ?? true;

  return (
    <section aria-labelledby="tagging-privacy-heading" className={styles.block}>
      <h2 id="tagging-privacy-heading" className={styles.blockHeading}>
        Photo &amp; post tagging
      </h2>
      <label className={styles.radioRow}>
        <input
          type="checkbox"
          checked={allowTagging}
          disabled={taggingQuery.isLoading || updateMutation.isPending}
          onChange={(event) => updateMutation.mutate(event.currentTarget.checked)}
        />
        <span>
          <span className={styles.toggleLabel}>Allow people to tag me in posts</span>
          <span className={styles.muted}>When turned off, nobody can add your profile to post tags.</span>
        </span>
      </label>
    </section>
  );
}
