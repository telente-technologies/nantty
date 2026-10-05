"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { mediaDownloadsService } from "@/services/mediaDownloads.service";

import { ConsentToggleRow } from "./consentToggleRow";
import styles from "./settings.module.css";

const downloadSettingsQueryKey = ["users", "me", "download-settings"] as const;

export function DownloadPrivacySection() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: downloadSettingsQueryKey, queryFn: mediaDownloadsService.fetchMyDownloadSettings });
  const update = useMutation({
    mutationFn: (allowDownloads: boolean) => mediaDownloadsService.updateMyDownloadSettings({ allowDownloads }),
    onSuccess: (next) => queryClient.setQueryData(downloadSettingsQueryKey, next),
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });
  return (
    <section aria-labelledby="download-privacy-heading" className={styles.block}>
      <h2 id="download-privacy-heading" className={styles.blockHeading}>Downloads</h2>
      <ConsentToggleRow
        label="Allow downloads"
        description="People can save your photos and clips. Saved copies carry the Zudomart logo and your @username. Private, subscriber-only posts and stories are never downloadable."
        enabled={update.variables ?? query.data?.allowDownloads ?? true}
        disabled={update.isPending || query.isLoading}
        onChange={(enabled) => update.mutate(enabled)}
      />
    </section>
  );
}
