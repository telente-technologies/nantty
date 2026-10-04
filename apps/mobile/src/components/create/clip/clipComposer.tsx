import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { CreateHeader } from "@/components/create/createHeader";
import type { CreateMode, ID, Post } from "@/types";
import type { MentionEntity } from "@/types/mention.type";
import { shiftMentionsAfterTrimmingStart } from "@/utils/mentions.util";

import { usePostDraftMediaUploads } from "../postDraftUploads.hook";
import { usePublishPost } from "../publishPost.hook";
import { buildPostSettingsFields, DEFAULT_POST_SETTINGS, type PostSettingsValue } from "../settings/postSettings.type";
import { PostSettingsStep } from "../settings/postSettingsStep";
import { ClipDetailsStage } from "./clipDetailsStage";
import {
  EMPTY_CLIP_EDITS,
  buildClipCreateFields,
  clampPhotoSeconds,
  defaultTrimFor,
  formatClipSeconds,
  readClipSource,
  secondsForPhoto,
  totalClipSeconds,
  validateClipDraft,
  type ClipEdits,
} from "./clipDraft.util";
import { ClipMediaStage } from "./clipMediaStage";
import { ClipPreviewStage } from "./clipPreviewStage";

type ClipStage = "media" | "preview" | "details" | "settings";

const PREVIOUS_STAGE: Readonly<Record<Exclude<ClipStage, "media">, ClipStage>> = { preview: "media", details: "preview", settings: "details" };
const STAGE_TITLES: Readonly<Record<ClipStage, string>> = { media: "New clip", preview: "Preview", details: "Caption and sound", settings: "Post settings" };

export interface ClipComposerProps {
  readonly mode: CreateMode;
  readonly initialSoundId: ID | null;
  readonly onChangeMode: (mode: CreateMode) => void;
  readonly onClose: () => void;
  readonly onPublished: (post: Post) => void;
}

export function ClipComposer({ mode, initialSoundId, onChangeMode, onClose, onPublished }: ClipComposerProps) {
  const uploads = usePostDraftMediaUploads("clip");
  const [stage, setStage] = useState<ClipStage>("media");
  const [edits, setEdits] = useState<ClipEdits>(EMPTY_CLIP_EDITS);
  const [caption, setCaption] = useState<{ text: string; mentions: readonly MentionEntity[] }>({ text: "", mentions: [] });
  const [soundId, setSoundId] = useState<ID | null>(initialSoundId);
  const [settings, setSettings] = useState<PostSettingsValue>(DEFAULT_POST_SETTINGS);
  const items = uploads.draftMediaItems;
  const source = readClipSource(items);
  const validationMessage = validateClipDraft(items, edits);
  const totalSeconds = totalClipSeconds(items, edits);

  useEffect(() => {
    if (stage !== "media" && items.length === 0) setStage("media");
  }, [stage, items.length]);

  const publish = usePublishPost({
    draftMediaItems: items,
    combinedUploadedFraction: uploads.combinedUploadedFraction,
    waitForAllDraftMediaIds: uploads.waitForAllDraftMediaIds,
    fillLocalPreviews: source === "video",
    onPublished,
    buildInput: (mediaIds) => {
      const trimmed = shiftMentionsAfterTrimmingStart(caption.text, caption.mentions);
      return {
        text: trimmed.text,
        mentions: trimmed.mentions,
        audience: "everyone",
        kind: "clip",
        mediaIds,
        ...buildClipCreateFields(items, mediaIds, edits),
        ...buildPostSettingsFields(settings),
        ...(soundId ? { soundId } : {}),
      };
    },
  });

  const discardMediaAndExit = (next: () => void) => {
    uploads.discardAllDraftMedia();
    setEdits(EMPTY_CLIP_EDITS);
    next();
  };
  const goBack = () => {
    if (stage === "media") return discardMediaAndExit(onClose);
    if (stage === "preview") return discardMediaAndExit(() => setStage("media"));
    setStage(PREVIOUS_STAGE[stage]);
  };
  const nextStage: ClipStage | null = stage === "preview" ? "details" : stage === "details" ? "settings" : null;

  return (
    <View style={styles.flex}>
      <CreateHeader
        title={STAGE_TITLES[stage]}
        onClose={goBack}
        useBackArrow={stage !== "media"}
        actionLabel={nextStage ? "Next" : undefined}
        actionDisabled={!!validationMessage}
        onAction={() => nextStage && setStage(nextStage)}
      />
      {stage === "media" || !source ? (
        <ClipMediaStage
          mode={mode}
          onChangeMode={(next) => discardMediaAndExit(() => onChangeMode(next))}
          onPicked={async (files) => {
            await uploads.addPickedMediaAndStartUploading(files);
            const video = files.find((file) => file.mediaType === "video");
            setEdits({ ...EMPTY_CLIP_EDITS, trim: video ? defaultTrimFor(video.durationSeconds) : null });
            setStage("preview");
          }}
        />
      ) : stage === "preview" ? (
        <ClipPreviewStage
          items={items}
          source={source}
          totalSeconds={totalSeconds}
          validationMessage={validationMessage}
          trim={edits.trim}
          onChangeTrim={(trim) => setEdits((current) => ({ ...current, trim }))}
          transition={edits.transition}
          onChangeTransition={(transition) => setEdits((current) => ({ ...current, transition }))}
          secondsFor={(jobId) => secondsForPhoto(edits, jobId)}
          onChangeSeconds={(jobId, seconds) => setEdits((current) => ({ ...current, photoSeconds: { ...current.photoSeconds, [jobId]: clampPhotoSeconds(seconds) } }))}
          onMove={uploads.moveDraftMediaItem}
          onRemove={uploads.removeDraftMediaItem}
        />
      ) : stage === "details" ? (
        <ClipDetailsStage
          text={caption.text}
          mentions={caption.mentions}
          onChangeCaption={(text, mentions) => setCaption({ text, mentions })}
          coverUri={items[0]?.previewUri ?? null}
          lengthLabel={formatClipSeconds(totalSeconds)}
          hasOwnAudio={source === "video"}
          selectedSoundId={soundId}
          onChangeSelectedSoundId={setSoundId}
        />
      ) : (
        <PostSettingsStep
          value={settings}
          onChange={setSettings}
          caption={caption.text}
          mentions={caption.mentions}
          thumbnailUri={items[0]?.previewUri ?? null}
          mediaSummary={`${source === "photos" ? `Photo clip, ${items.length} photos` : "Video clip"}, ${formatClipSeconds(totalSeconds)}`}
          publishing={publish.mutation.isPending}
          publishButtonTitle={publish.buttonTitle}
          publishErrorMessage={publish.errorMessage ?? validationMessage}
          onPublish={() => publish.mutation.mutate()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
