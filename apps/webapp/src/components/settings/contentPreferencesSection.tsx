"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { contentPreferencesService } from "@/services/contentPreferences.service";

import { ConsentToggleRow } from "./consentToggleRow";
import styles from "./settings.module.css";

export function ContentPreferencesSection() {
  const queryClient = useQueryClient();
  const preferencesQuery = useQuery({ queryKey: ["contentPreferences"], queryFn: contentPreferencesService.fetchContentPreferences, retry: false });
  const update = useMutation({
    mutationFn: contentPreferencesService.updateContentPreferences,
    onSuccess: (preferences) => {
      queryClient.setQueryData(["contentPreferences"], preferences);
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      showToast({ text: "Content preferences saved" });
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });
  const preferences = preferencesQuery.data;

  return (
    <section aria-labelledby="content-preferences-heading" className={styles.block}>
      <h2 id="content-preferences-heading" className={styles.blockHeading}>
        Content preferences
      </h2>
      {preferences?.canChangeSensitiveContentSetting ? (
        <ConsentToggleRow
          label="Show sensitive content without warning"
          description="Posts marked as sensitive open straight away instead of showing a warning first. You can turn warnings back on at any time."
          enabled={update.isPending ? (update.variables ?? preferences.showSensitiveWithoutWarning) : preferences.showSensitiveWithoutWarning}
          disabled={update.isPending}
          onChange={(enabled) => update.mutate(enabled)}
        />
      ) : preferences ? (
        <p className={styles.muted}>
          {preferences.ageBracket === "unknown"
            ? "Add your birthday in the app under Settings, Account to manage this. Until then we treat your account as under 18, so adult content is never shown."
            : "Accounts under 18 always see warnings, and adult content such as nudity or dangerous acts is never shown."}
        </p>
      ) : null}
      <p className={styles.muted}>Sensitive labels come from the person who posted, from our moderators and from automated checks that our team reviews.</p>
    </section>
  );
}
