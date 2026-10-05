import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { mediaDownloadsService } from "@/services/mediaDownloads.service";
import type { DownloadSettings } from "@/types";

import { ConsentToggleRow } from "./consentToggleRow";

const DOWNLOAD_SETTINGS_QUERY_KEY = ["users", "me", "download-settings"] as const;

export function DownloadPrivacySection() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: DOWNLOAD_SETTINGS_QUERY_KEY, queryFn: mediaDownloadsService.fetchMyDownloadSettings });
  const updateSettings = useMutation({
    mutationFn: (next: DownloadSettings) => mediaDownloadsService.updateMyDownloadSettings(next),
    onSuccess: (saved) => queryClient.setQueryData(DOWNLOAD_SETTINGS_QUERY_KEY, saved),
  });
  const allowDownloads = updateSettings.variables?.allowDownloads ?? settings.data?.allowDownloads ?? true;
  return (
    <ConsentToggleRow
      label="Allow downloads"
      description="People can save your photos and clips. Saved copies carry the Zudomart logo and your @username. Private, subscriber-only posts and stories are never downloadable."
      enabled={allowDownloads}
      onChange={(enabled) => updateSettings.mutate({ allowDownloads: enabled })}
    />
  );
}
