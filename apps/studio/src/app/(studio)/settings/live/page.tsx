"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ModerationFields } from "@/components/golive/moderationFields";
import { ModeratorPicker } from "@/components/settings/moderatorPicker";
import styles from "@/components/settings/settings.module.css";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, Muted, pageStyles } from "@/components/ui/studioPage";
import { studioLiveService } from "@/services/studioLive.service";
import type { HostDefaults, ModeratorSummary, RoomSettingsInput } from "@/types/studioLive.type";
import { readLiveErrorMessage } from "@/utils/liveStoreErrors.util";

interface Draft {
  readonly moderation: RoomSettingsInput;
  readonly moderators: readonly ModeratorSummary[];
}

const QUERY_KEY = ["live", "host-defaults"];

const toDraft = (defaults: HostDefaults): Draft => ({
  moderation: { commentsEnabled: defaults.commentsEnabled, commentAudience: defaults.commentAudience, slowModeSeconds: defaults.slowModeSeconds, blockedWords: defaults.blockedWords },
  moderators: defaults.moderators,
});

export default function LiveDefaultsPage() {
  const queryClient = useQueryClient();
  const defaults = useQuery({ queryKey: QUERY_KEY, queryFn: studioLiveService.fetchHostDefaults });
  const [draft, setDraft] = useState<Draft | null>(null);
  const save = useMutation({
    mutationFn: (value: Draft) => studioLiveService.saveHostDefaults({ ...value.moderation, moderatorIds: value.moderators.map((person) => person.id) }),
    onSuccess: (saved) => {
      queryClient.setQueryData(QUERY_KEY, saved);
      setDraft(null);
    },
  });

  if (defaults.isError) return <ErrorState title="Live defaults didn't load" error={defaults.error} onRetry={() => void defaults.refetch()} />;
  if (!defaults.data) return <Skeleton height={320} />;
  const value = draft ?? toDraft(defaults.data);
  const edit = (change: Partial<Draft>) => setDraft({ ...value, ...change });

  return (
    <form className={pageStyles.page} onSubmit={(event) => { event.preventDefault(); if (draft && !save.isPending) save.mutate(draft); }} aria-label="Live defaults">
      <Muted>These settings are copied to every new live. Lives you've already created keep their own settings, which you can change from the control room.</Muted>
      <div className={pageStyles.columns}>
        <Card title="Chat">
          <ModerationFields value={value.moderation} onChange={(moderation) => edit({ moderation })} />
        </Card>
        <Card title="Default moderators">
          <ModeratorPicker selected={value.moderators} onChange={(moderators) => edit({ moderators })} />
        </Card>
      </div>
      <div className={styles.formFoot}>
        <Button type="submit" busy={save.isPending} disabled={!draft}>Save live defaults</Button>
        {draft ? <Button variant="ghost" onClick={() => setDraft(null)}>Discard changes</Button> : null}
        {save.isSuccess && !draft ? <span className={styles.status} role="status">Saved. New lives will use these settings.</span> : null}
      </div>
      {save.isError ? <p className={styles.error} role="alert">{readLiveErrorMessage(save.error)}</p> : null}
    </form>
  );
}
