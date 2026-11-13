"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { useSession } from "@/components/providers/sessionProvider";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { soundsService } from "@/services/sounds.service";

import styles from "../page.module.css";

export default function SoundDetailPage() {
  const params = useParams<{ soundId: string }>();
  const soundId = params.soundId;
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const sound = useQuery({ queryKey: ["sounds", soundId], queryFn: () => soundsService.fetchSoundById(soundId) });
  const clips = useQuery({ queryKey: ["sounds", soundId, "clips"], queryFn: () => soundsService.fetchClipsUsingSound(soundId), enabled: !!sound.data });
  const toggleSave = useMutation({
    mutationFn: () => (sound.data?.savedByViewer ? soundsService.unsaveSound(soundId) : soundsService.saveSound(soundId)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["sounds", soundId] }),
    onError: (mutationError) => showToast({ text: readErrorMessageForDisplay(mutationError), tone: "error" }),
  });
  if (sound.isLoading) return <ListRowsSkeleton label="Loading sound" rows={4} />;
  if (sound.isError || !sound.data) return <ErrorState description="This sound isn't available right now." error={sound.error} onRetry={() => void sound.refetch()} />;
  const data = sound.data;
  return (
    <div className={styles.page}>
      <header className={styles.soundHeader}>
        <div>
          <h1 className={styles.title}>{data.isOriginal ? "Original sound" : data.title}</h1>
          <p className={styles.note}>@{data.owner.username} · {data.usageCount.toLocaleString()} uses · {data.status}</p>
        </div>
        <ContentActionsMenu shareKind={null} reportTargetType="sound" targetId={data.id} canonicalPath={`/sounds/${encodeURIComponent(data.id)}`} soundId={data.id} isOwnContent={viewer?.id === data.owner.id} />
      </header>
      {data.audioUrl ? (
        <audio className={styles.media} src={data.audioUrl} controls preload="none" aria-label={data.title} />
      ) : null}
      <div className={styles.controls}>
        {data.allowReuse && data.status === "available" ? <Link className={styles.primary} href={`/create/clip?soundId=${encodeURIComponent(data.id)}`}>Use this sound</Link> : null}
        <button type="button" className={styles.linkButton} disabled={toggleSave.isPending} onClick={() => toggleSave.mutate()}>
          {data.savedByViewer ? "Unsave" : "Save"}
        </button>
      </div>
      <section className={styles.section} aria-label="Clips using this sound">
        <h2 className={styles.sectionTitle}>Clips using this sound</h2>
        {!clips.data || clips.data.data.length === 0 ? (
          <p className={styles.note}>No clips use this sound yet.</p>
        ) : (
          <div className={styles.grid}>
            {clips.data.data.map((clip) => {
              const poster = clip.media[0]?.posterUrl ?? clip.media[0]?.url;
              return (
                <div key={clip.id} className={styles.tile}>
                  {poster ? <img className={styles.tileImage} src={poster} alt="" loading="lazy" /> : null}
                  <div className={styles.tileBody}>
                    <span className={styles.rowMeta}>@{clip.author.username}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
