"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestConfirmation } from "@zudomart/web-kit";

import { Button } from "@/components/ui/button";
import { readPublicSiteUrl } from "@/config/studioEnvironment.config";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { livesService } from "@/services/lives.service";
import type { ID } from "@/types";

import { CopyField, copyGridClassName } from "./copyField";
import styles from "./goLive.module.css";

export function EncoderSetupCard({ liveId, hlsUrl, ended }: { readonly liveId: ID; readonly hlsUrl: string | null; readonly ended: boolean }) {
  const queryClient = useQueryClient();
  const streamKey = useQuery({ queryKey: ["live-stream-key", liveId], queryFn: () => livesService.fetchStreamKey(liveId), enabled: !ended });
  const overlayScene = useQuery({ queryKey: ["overlay-scene", liveId], queryFn: () => livesService.fetchOverlays(liveId) });
  const rotateKey = useMutation({ mutationFn: () => livesService.rotateStreamKey(liveId), onSuccess: (key) => queryClient.setQueryData(["live-stream-key", liveId], key) });
  const overlayUrl = overlayScene.data ? `${readPublicSiteUrl()}/overlay/${overlayScene.data.id}` : null;

  async function confirmRotateKey() {
    if (streamKey.data) {
      const confirmed = await requestConfirmation({ title: "Rotate the stream key?", description: "The current key stops working at once. Paste the new key into OBS before you stream again.", confirmLabel: "Rotate key", intent: "key" });
      if (!confirmed) return;
    }
    if (!rotateKey.isPending) rotateKey.mutate();
  }

  return (
    <div className={styles.encoder}>
      <div className={styles.encoderHead}>
        <ol className={styles.steps}>
          <li>Open OBS › Settings › Stream, then choose <strong>Custom…</strong> as the service.</li>
          <li>Paste the server URL below into <strong>Server</strong> and the stream key into <strong>Stream Key</strong>.</li>
          <li>Add the overlay as a <strong>Browser</strong> source at 1920 × 1080, then press Start Streaming.</li>
          <li>When Stream health shows <strong>Receiving your stream</strong>, press Start live so viewers can watch.</li>
        </ol>
        {ended ? null : (
          <Button variant="secondary" size="sm" busy={rotateKey.isPending} onClick={() => void confirmRotateKey()}>
            {streamKey.data ? "Rotate stream key" : "Create stream key"}
          </Button>
        )}
      </div>
      {ended ? <p className={styles.muted}>This live has ended, so its stream key no longer works.</p> : null}
      {!ended && streamKey.isSuccess && !streamKey.data ? <p className={styles.muted}>No stream key yet. Create one to connect your encoder.</p> : null}
      {streamKey.isError ? <p className={styles.alert} role="alert">{readErrorMessageForDisplay(streamKey.error)}</p> : null}
      {rotateKey.isError ? <p className={styles.alert} role="alert">{readErrorMessageForDisplay(rotateKey.error)}</p> : null}
      <div className={copyGridClassName}>
        {streamKey.data ? <CopyField label="Server URL" value={streamKey.data.ingestUrl} /> : null}
        {streamKey.data ? <CopyField label="Stream key" value={streamKey.data.streamKey} masked /> : null}
        {overlayUrl ? <CopyField label="Overlay browser source (1920 × 1080)" value={overlayUrl} /> : null}
        {hlsUrl ? <CopyField label="Playback (HLS)" value={hlsUrl} /> : null}
      </div>
    </div>
  );
}
