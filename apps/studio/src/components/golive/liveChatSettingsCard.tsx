"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card } from "@/components/ui/studioPage";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { studioLiveService } from "@/services/studioLive.service";
import type { ID } from "@/types";
import type { RoomSettings, RoomSettingsInput } from "@/types/studioLive.type";

import { ModerationFields } from "./moderationFields";
import styles from "./moderation.module.css";

const toInput = (settings: RoomSettings): RoomSettingsInput => ({
  commentsEnabled: settings.commentsEnabled,
  commentAudience: settings.commentAudience ?? "everyone",
  slowModeSeconds: settings.slowModeSeconds,
  blockedWords: settings.blockedWords ?? [],
});

export function LiveChatSettingsCard({ liveId }: { readonly liveId: ID }) {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["room-settings", liveId], queryFn: () => studioLiveService.fetchRoomSettings(liveId) });
  const [draft, setDraft] = useState<RoomSettingsInput | null>(null);
  const save = useMutation({
    mutationFn: (input: RoomSettingsInput) => studioLiveService.saveRoomSettings(liveId, input),
    onSuccess: (saved) => {
      queryClient.setQueryData(["room-settings", liveId], saved);
      setDraft(null);
    },
  });

  if (settings.isError) return <ErrorState title="Chat settings didn't load" error={settings.error} onRetry={() => void settings.refetch()} />;
  if (!settings.data) return <Card title="Chat settings"><Skeleton height={160} /></Card>;
  const value = draft ?? toInput(settings.data);

  return (
    <Card title="Chat settings">
      <p className={styles.muted}>Changes apply to this live straight away. Set defaults for every live in Settings › Live defaults.</p>
      <ModerationFields value={value} onChange={setDraft} />
      <div className={styles.formFoot}>
        <Button busy={save.isPending} disabled={!draft} onClick={() => draft && save.mutate(draft)}>Save chat settings</Button>
        {draft ? <Button variant="ghost" onClick={() => setDraft(null)}>Discard changes</Button> : null}
        {save.isSuccess && !draft ? <span className={styles.muted} role="status">Saved</span> : null}
      </div>
      {save.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(save.error)}</p> : null}
    </Card>
  );
}
