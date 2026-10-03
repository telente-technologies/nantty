"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { mentionsService } from "@/services/mentions.service";
import type { WhoCanMentionMe } from "@/types";

import styles from "./settings.module.css";

const mentionAudienceOptions: readonly { readonly value: WhoCanMentionMe; readonly label: string; readonly description: string }[] = [
  { value: "everyone", label: "Everyone", description: "Anyone who hasn't been blocked can tag you." },
  { value: "following", label: "People you follow", description: "Only accounts you follow can tag you." },
  { value: "no_one", label: "No one", description: "Tags of you show as plain text and you won't be notified." },
];

export function MentionPrivacySection() {
  const queryClient = useQueryClient();
  const privacyQuery = useQuery({ queryKey: ["mentionPrivacy"], queryFn: mentionsService.fetchMyMentionPrivacy, retry: false });
  const updateMutation = useMutation({
    mutationFn: (whoCanMentionMe: WhoCanMentionMe) => mentionsService.updateMyMentionPrivacy(whoCanMentionMe),
    onMutate: (whoCanMentionMe) => queryClient.setQueryData(["mentionPrivacy"], { whoCanMentionMe }),
    onSuccess: () => showToast({ text: "Mention setting saved" }),
    onError: (error) => {
      showToast({ text: readErrorMessageForDisplay(error), tone: "error" });
      void queryClient.invalidateQueries({ queryKey: ["mentionPrivacy"] });
    },
  });
  const current = privacyQuery.data?.whoCanMentionMe ?? "everyone";

  return (
    <section aria-labelledby="mention-privacy-heading" className={styles.block}>
      <h2 id="mention-privacy-heading" className={styles.blockHeading}>
        Who can mention me
      </h2>
      <fieldset className={styles.radioGroup} disabled={privacyQuery.isLoading}>
        <legend className="visuallyHidden">Who can mention me</legend>
        {mentionAudienceOptions.map((option) => (
          <label key={option.value} className={styles.radioRow}>
            <input type="radio" name="who-can-mention-me" value={option.value} checked={current === option.value} onChange={() => updateMutation.mutate(option.value)} />
            <span>
              <span className={styles.toggleLabel}>{option.label}</span>
              <span className={styles.muted}>{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
