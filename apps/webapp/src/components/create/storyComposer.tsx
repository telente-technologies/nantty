"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { ImageIcon } from "@/components/ui/icons";
import { useIsOnline } from "@/components/ui/onlineStatus.hook";
import { showToast } from "@/components/ui/toast";
import { createIdempotencyKey, readErrorMessageForDisplay } from "@/services/clientApi.service";
import { storiesService } from "@/services/stories.service";
import type { ID } from "@/types";
import { CLIP_LOOK_LABELS, CLIP_LOOKS, type ClipLookId } from "@/utils/clipDraft.util";
import { ALLOWED_IMAGE_MIME_TYPES, ALLOWED_VIDEO_MIME_TYPES } from "@/utils/mediaUploadRules.util";

import { ComposerMediaGrid } from "./composerMediaGrid";
import { useComposerMediaUploads } from "./composerMediaUploads.hook";
import styles from "./composer.module.css";
import { SoundPicker } from "./soundPicker";

const acceptedStoryMedia = [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_VIDEO_MIME_TYPES].join(",");

export function StoryComposer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const viewerId = useSession().viewer?.id ?? "";
  const isOnline = useIsOnline();
  const uploads = useComposerMediaUploads("story");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [soundId, setSoundId] = useState<ID | null>(null);
  const [look, setLook] = useState<ClipLookId>("none");
  const [rejected, setRejected] = useState<readonly string[]>([]);
  const publishKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  const item = uploads.items[0];

  useEffect(() => {
    if (!item) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [item]);

  const chooseFile = async (files: readonly File[]) => {
    const [file] = files;
    if (!file) return;
    uploads.clearAll();
    publishKey.current = null;
    setRejected(await uploads.addFiles([file]));
  };

  const publish = useMutation({
    mutationFn: async () => {
      const [mediaId] = await uploads.waitForAllMediaIds();
      if (!mediaId) throw new Error("Add a photo or video for your story.");
      publishKey.current ??= createIdempotencyKey("story");
      return storiesService.publishStory({ mediaId, ...(soundId ? { soundId } : {}), ...(look !== "none" ? { look } : {}) }, publishKey.current);
    },
    onSuccess: () => {
      publishKey.current = null;
      void queryClient.invalidateQueries({ queryKey: ["story-tray"] });
      uploads.clearAll();
      showToast({ text: "Your story is live for 24 hours" });
      router.replace(viewerId ? `/stories/${encodeURIComponent(viewerId)}` : "/stories");
    },
  });

  const canPublish = Boolean(item) && !uploads.hasFailedUploads && isOnline;
  const submit = () => {
    if (!canPublish || inFlight.current) return;
    inFlight.current = true;
    publish.mutate(undefined, { onSettled: () => { inFlight.current = false; } });
  };

  return (
    <form className={styles.composer} aria-labelledby="story-composer-title" onSubmit={(event) => { event.preventDefault(); submit(); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!publish.isPending) void chooseFile([...event.dataTransfer.files]); }}>
      <header className={styles.header}>
        <h1 id="story-composer-title" className={styles.title}>Story</h1>
        <Button type="submit" busy={publish.isPending} disabled={!canPublish}>
          {publish.isPending && uploads.combinedUploadedFraction < 1 ? `Uploading ${Math.round(uploads.combinedUploadedFraction * 100)}%…` : publish.isPending ? "Sharing…" : "Share story"}
        </Button>
      </header>
      {isOnline ? null : <p className={styles.offlineNotice} role="status">You&apos;re offline. Uploads resume when you&apos;re back online.</p>}
      <input ref={fileInputRef} type="file" accept={acceptedStoryMedia} hidden onChange={(event) => { void chooseFile([...(event.target.files ?? [])]); event.target.value = ""; }} />
      {item ? (
        <div className={styles.clipStage}>
          {item.mediaType === "video" ? <video src={item.previewUrl} muted playsInline autoPlay loop aria-label="Story preview" /> : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.previewUrl} alt="Story preview" />
          )}
          <span className={styles.lookOverlay} data-look={look} aria-hidden="true" />
        </div>
      ) : null}
      {item ? <ComposerMediaGrid items={uploads.items} disabled={publish.isPending} onRemove={uploads.removeItem} onRetry={uploads.retryItem} onMove={uploads.moveItem} /> : null}
      <button type="button" className={styles.toolButton} disabled={publish.isPending} onClick={() => fileInputRef.current?.click()}>
        <ImageIcon size={20} />
        <span>{item ? "Choose a different photo or video" : "Choose a photo or video"}</span>
      </button>
      <p className={styles.hint}>Stories disappear after 24 hours. Videos can be up to 1 minute.</p>
      {rejected.length > 0 ? <div className={styles.fieldError} role="alert">{rejected.map((message) => <p key={message}>{message}</p>)}</div> : null}
      <div className={styles.labelChips} role="radiogroup" aria-label="Choose a color look">
        {CLIP_LOOKS.map((option) => (
          <button key={option} type="button" role="radio" aria-checked={look === option} className={styles.labelChip} aria-pressed={look === option} onClick={() => { publishKey.current = null; setLook(option); }}>
            {CLIP_LOOK_LABELS[option]}
          </button>
        ))}
      </div>
      <SoundPicker selectedSoundId={soundId} onChange={(next) => { publishKey.current = null; setSoundId(next); }} hasOwnAudio />
      {publish.isError ? <p className={styles.fieldError} role="alert">{publish.error instanceof Error && !("status" in publish.error) ? publish.error.message : readErrorMessageForDisplay(publish.error)}</p> : null}
    </form>
  );
}
