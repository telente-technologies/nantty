"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { MentionAutocompleteInput } from "@/components/mentions/mentionAutocompleteInput";
import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import { ImageIcon } from "@/components/ui/icons";
import { useIsOnline } from "@/components/ui/onlineStatus.hook";
import { showToast } from "@/components/ui/toast";
import { createIdempotencyKey, readErrorMessageForDisplay } from "@/services/clientApi.service";
import { composerService } from "@/services/composer.service";
import { contentPreferencesService } from "@/services/contentPreferences.service";
import type { ClipTransition, ID, ReplyToComment } from "@/types";
import {
  buildClipCreateFields, clampPhotoSeconds, clampTrim, CLIP_LOOK_LABELS, CLIP_LOOKS, defaultTrimFor, EMPTY_CLIP_EDITS, formatClipSeconds, readClipSource, secondsForPhoto, totalClipSeconds, validateClipDraft, type ClipEdits,
} from "@/utils/clipDraft.util";
import { describePublishButton, EMPTY_COMPOSER_DRAFT, type ComposerDraft } from "@/utils/composerDraft.util";
import { ALLOWED_IMAGE_MIME_TYPES, ALLOWED_VIDEO_MIME_TYPES } from "@/utils/mediaUploadRules.util";
import { buildMentionEntitiesFromText } from "@/utils/mentions.util";

import { ComposerMediaGrid } from "./composerMediaGrid";
import { useComposerMediaUploads } from "./composerMediaUploads.hook";
import { ComposerSettings } from "./composerSettings";
import styles from "./composer.module.css";
import { SoundPicker } from "./soundPicker";

const CLIP_CAPTION_LIMIT = 2200;
const acceptedClipMedia = [...ALLOWED_VIDEO_MIME_TYPES, ...ALLOWED_IMAGE_MIME_TYPES].join(",");

export function ClipComposer({ initialSoundId, replyToComment }: { readonly initialSoundId: ID | null; readonly replyToComment?: ReplyToComment }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const viewerId = useSession().viewer?.id ?? "";
  const isOnline = useIsOnline();
  const captionId = useId();
  const uploads = useComposerMediaUploads("clip");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [edits, setEdits] = useState<ClipEdits>(EMPTY_CLIP_EDITS);
  const [settings, setSettings] = useState<ComposerDraft>(EMPTY_COMPOSER_DRAFT);
  const [soundId, setSoundId] = useState<ID | null>(initialSoundId);
  const [rejected, setRejected] = useState<readonly string[]>([]);
  const publishKey = useRef<string | null>(null);
  const publishInFlight = useRef(false);
  const creatorStatus = useQuery({ queryKey: ["creator", "status", viewerId], queryFn: composerService.fetchMyCreatorStatus, enabled: viewerId !== "", retry: false });
  const preferences = useQuery({ queryKey: ["contentPreferences"], queryFn: contentPreferencesService.fetchContentPreferences, enabled: viewerId !== "", retry: false });
  const items = uploads.items;
  const source = readClipSource(items);
  const video = source === "video" ? items[0] : undefined;
  const effectiveEdits: ClipEdits = video ? { ...edits, trim: edits.trim ?? defaultTrimFor(video.durationSeconds) } : edits;
  const validationMessage = validateClipDraft(items, effectiveEdits);
  const totalSeconds = totalClipSeconds(items, effectiveEdits);

  const changeSettings = (next: ComposerDraft) => {
    publishKey.current = null;
    setSettings(next);
  };

  useEffect(() => {
    if (items.length === 0 && !publishInFlight.current) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [items.length]);

  const addFiles = async (files: readonly File[]) => {
    if (files.length === 0) return;
    publishKey.current = null;
    const problems = await uploads.addFiles(files);
    setRejected(problems);
  };

  const publish = useMutation({
    mutationFn: async () => {
      const mediaIds = await uploads.waitForAllMediaIds();
      const text = settings.text.trim();
      const fields = buildClipCreateFields(items, mediaIds, effectiveEdits);
      publishKey.current ??= createIdempotencyKey("clip");
      return composerService.publishPost({
        text,
        mediaIds,
        audience: "everyone",
        kind: "clip",
        ...(replyToComment ? { replyToComment } : {}),
        mentions: buildMentionEntitiesFromText(text, settings.mentions),
        replyPolicy: settings.replyPolicy,
        visibility: settings.visibility,
        ...fields,
        ...(edits.look !== "none" ? { look: edits.look } : {}),
        ...(soundId ? { soundId } : {}),
        ...(settings.isAiGenerated ? { isAiGenerated: true } : {}),
        ...(settings.sensitiveLabels.length > 0 ? { sensitiveLabels: settings.sensitiveLabels } : {}),
        ...(settings.tagged.length > 0 ? { taggedUserIds: settings.tagged.map((person) => person.id) } : {}),
        ...(settings.products.length > 0 ? { productIds: settings.products.map((product) => product.id) } : {}),
        ...(settings.location ? { location: settings.location } : {}),
      }, publishKey.current);
    },
    onSuccess: (post) => {
      publishKey.current = null;
      queryClient.setQueryData(["post", post.id], post);
      void queryClient.invalidateQueries({ queryKey: ["clips"] });
      uploads.clearAll();
      showToast({ text: "Your clip is posting. It'll appear once it finishes processing." });
      router.replace(`/post/${encodeURIComponent(post.id)}`);
    },
  });

  const canPublish = !validationMessage && !uploads.hasFailedUploads && isOnline && settings.text.length <= CLIP_CAPTION_LIMIT;
  const submit = () => {
    if (!canPublish || publishInFlight.current) return;
    publishInFlight.current = true;
    publish.mutate(undefined, { onSettled: () => { publishInFlight.current = false; } });
  };
  const updateEdits = (next: ClipEdits) => {
    publishKey.current = null;
    setEdits(next);
  };

  return (
    <form className={styles.composer} aria-labelledby="clip-composer-title" onSubmit={(event) => { event.preventDefault(); submit(); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!publish.isPending) void addFiles([...event.dataTransfer.files]); }}>
      <header className={styles.header}>
        <h1 id="clip-composer-title" className={styles.title}>New clip</h1>
        <Button type="submit" busy={publish.isPending} disabled={!canPublish}>{describePublishButton(publish.isPending, uploads.combinedUploadedFraction)}</Button>
      </header>
      {isOnline ? null : <p className={styles.offlineNotice} role="status">You&apos;re offline. Uploads resume when you&apos;re back online.</p>}
      <input ref={fileInputRef} type="file" accept={acceptedClipMedia} multiple hidden onChange={(event) => { void addFiles([...(event.target.files ?? [])]); event.target.value = ""; }} />
      {video ? (
        <div className={styles.clipStage}>
          <video
            ref={videoRef}
            src={video.previewUrl}
            muted
            playsInline
            autoPlay
            loop
            aria-label="Clip preview"
            onTimeUpdate={(event) => {
              const trim = effectiveEdits.trim;
              if (trim && (event.currentTarget.currentTime >= trim.endSeconds || event.currentTarget.currentTime < trim.startSeconds - 0.25)) event.currentTarget.currentTime = trim.startSeconds;
            }}
          />
          <span className={styles.lookOverlay} data-look={edits.look} aria-hidden="true" />
        </div>
      ) : null}
      {items.length === 0 ? (
        <button type="button" className={styles.toolButton} onClick={() => fileInputRef.current?.click()}>
          <ImageIcon size={20} />
          <span>Choose a video or photos</span>
        </button>
      ) : null}
      {video?.durationSeconds && effectiveEdits.trim ? (
        <fieldset className={styles.settings}>
          <legend className={styles.settingsTitle}>Trim · {formatClipSeconds(totalSeconds)}</legend>
          {(["startSeconds", "endSeconds"] as const).map((edge) => (
            <label key={edge} className={styles.trimRow}>
              <span>{edge === "startSeconds" ? "Start" : "End"}</span>
              <input
                type="range"
                min={0}
                max={video.durationSeconds ?? 0}
                step={0.1}
                value={effectiveEdits.trim?.[edge] ?? 0}
                onChange={(event) => {
                  const trim = clampTrim({ ...effectiveEdits.trim!, [edge]: Number(event.target.value) }, video.durationSeconds!);
                  updateEdits({ ...edits, trim });
                  if (videoRef.current) videoRef.current.currentTime = trim.startSeconds;
                }}
              />
              <span>{formatClipSeconds(effectiveEdits.trim?.[edge] ?? 0)}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {source === "photos" ? (
        <fieldset className={styles.settings}>
          <legend className={styles.settingsTitle}>Photos · {formatClipSeconds(totalSeconds)}</legend>
          {items.map((item, index) => (
            <label key={item.localId} className={styles.photoRow}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.previewUrl} alt="" />
              <span>Photo {index + 1} shows for (seconds)</span>
              <input type="number" className={styles.inlineInput} min={1} max={10} value={secondsForPhoto(edits, item.localId)} onChange={(event) => updateEdits({ ...edits, photoSeconds: { ...edits.photoSeconds, [item.localId]: clampPhotoSeconds(Number(event.target.value) || 1) } })} />
            </label>
          ))}
          <SelectField label="Transition" value={edits.transition} onChange={(event) => updateEdits({ ...edits, transition: event.target.value as ClipTransition })}>
            <option value="crossfade">Crossfade</option>
            <option value="slide">Slide</option>
            <option value="none">None</option>
          </SelectField>
        </fieldset>
      ) : null}
      {items.length > 0 ? <ComposerMediaGrid items={items} disabled={publish.isPending} onRemove={(localId) => { uploads.removeItem(localId); updateEdits({ ...edits, trim: null }); }} onRetry={uploads.retryItem} onMove={uploads.moveItem} /> : null}
      {source === "photos" && items.length < 10 ? (
        <button type="button" className={styles.toolButton} onClick={() => fileInputRef.current?.click()}><ImageIcon size={20} /><span>Add photos</span></button>
      ) : null}
      {items.length > 0 && validationMessage ? <p className={styles.fieldError} role="alert">{validationMessage}</p> : null}
      {rejected.length > 0 ? <div className={styles.fieldError} role="alert">{rejected.map((message) => <p key={message}>{message}</p>)}</div> : null}
      <div className={styles.labelChips} role="radiogroup" aria-label="Choose a color look">
        {CLIP_LOOKS.map((look) => (
          <button key={look} type="button" role="radio" aria-checked={edits.look === look} className={styles.labelChip} aria-pressed={edits.look === look} onClick={() => updateEdits({ ...edits, look })}>
            {CLIP_LOOK_LABELS[look]}
          </button>
        ))}
      </div>
      <MentionAutocompleteInput
        id={captionId}
        multiline
        rows={3}
        value={settings.text}
        onChange={(text) => changeSettings({ ...settings, text })}
        chosenMentions={settings.mentions}
        onChooseMention={(mention) => changeSettings({ ...settings, mentions: settings.mentions.some((entry) => entry.userId === mention.userId) ? settings.mentions : [...settings.mentions, mention] })}
        placeholder="Add a caption"
        ariaLabel="Caption"
        className={styles.textInput}
        maxLength={CLIP_CAPTION_LIMIT}
        enabled={!publish.isPending}
        surface="post"
      />
      <SoundPicker selectedSoundId={soundId} onChange={(next) => { publishKey.current = null; setSoundId(next); }} hasOwnAudio={source !== "photos"} />
      <ComposerSettings draft={settings} onChange={changeSettings} isApprovedCreator={creatorStatus.data?.status === "approved"} isAdult={preferences.data?.ageBracket === "adult"} />
      {publish.isError ? <p className={styles.fieldError} role="alert">{publish.error instanceof Error && !("status" in publish.error) ? publish.error.message : readErrorMessageForDisplay(publish.error)}</p> : null}
    </form>
  );
}
