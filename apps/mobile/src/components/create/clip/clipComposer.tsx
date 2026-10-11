import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { CreateHeader } from "@/components/create/createHeader";
import { DraftsButton } from "@/components/create/draftsSheet";
import type { ClipTransition, CreateMode, ID, Post } from "@/types";
import type { MentionEntity } from "@/types/mention.type";
import type { LocalMediaFile } from "@/services/media/mediaPreparation.service";
import { useActingProfileStore } from "@/store/actingProfile.store";
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
  type ClipTrim,
} from "./clipDraft.util";
import type { ClipLookId } from "./clipLook.constant";
import { ClipMediaStage } from "./clipMediaStage";
import { ClipPreviewStage } from "./clipPreviewStage";

type ClipStage = "media" | "preview" | "details" | "settings";

const PREVIOUS_STAGE: Readonly<Record<Exclude<ClipStage, "media">, ClipStage>> = { preview: "media", details: "preview", settings: "details" };
const STAGE_TITLES: Readonly<Record<ClipStage, string>> = { media: "New clip", preview: "Preview", details: "Caption and sound", settings: "Post settings" };

export interface ClipComposerSeed {
  readonly text: string;
  readonly mentions: readonly MentionEntity[];
  readonly soundId: ID | null;
  readonly settings: PostSettingsValue;
  readonly files: readonly LocalMediaFile[];
  readonly photoDurations: readonly number[];
  readonly trim: ClipTrim | null;
  readonly transition: ClipTransition;
  readonly look: ClipLookId;
}

export interface ClipComposerProps {
  readonly mode: CreateMode;
  readonly initialSoundId: ID | null;
  readonly initialDraft?: ClipComposerSeed | null;
  readonly onChangeMode: (mode: CreateMode) => void;
  readonly onClose: () => void;
  readonly onPublished: (post: Post) => void;
  readonly onSaveDraft?: (seed: ClipComposerSeed) => void;
}

export function ClipComposer({ mode, initialSoundId, initialDraft = null, onChangeMode, onClose, onPublished, onSaveDraft }: ClipComposerProps) {
  const uploads = usePostDraftMediaUploads("clip");
  const [chosenStage, setStage] = useState<ClipStage>(initialDraft && initialDraft.files.length > 0 ? "preview" : "media");
  const [edits, setEdits] = useState<ClipEdits>({
    ...EMPTY_CLIP_EDITS,
    trim: initialDraft?.trim ?? EMPTY_CLIP_EDITS.trim,
    transition: initialDraft?.transition ?? EMPTY_CLIP_EDITS.transition,
    look: initialDraft?.look ?? EMPTY_CLIP_EDITS.look,
  });
  const [caption, setCaption] = useState<{ text: string; mentions: readonly MentionEntity[] }>(
    initialDraft ? { text: initialDraft.text, mentions: initialDraft.mentions } : { text: "", mentions: [] },
  );
  const [soundId, setSoundId] = useState<ID | null>(initialDraft?.soundId ?? initialSoundId);
  const [settings, setSettings] = useState<PostSettingsValue>(initialDraft?.settings ?? DEFAULT_POST_SETTINGS);
  const [seedConsumed, setSeedConsumed] = useState(false);
  const items = uploads.draftMediaItems;
  const actingProfileId = useActingProfileStore((s) => s.actingProfile?.id ?? null);
  const source = readClipSource(items);
  const stage: ClipStage = source ? chosenStage : "media";

  useEffect(() => {
    if (!initialDraft || seedConsumed || initialDraft.files.length === 0) return;
    setSeedConsumed(true);
    void (async () => {
      const jobIds = await uploads.addPickedMediaAndStartUploading(initialDraft.files);
      if (initialDraft.photoDurations.length > 0) {
        setEdits((current) => {
          const photoSeconds: Record<ID, number> = {};
          jobIds.forEach((jobId, index) => {
            const seconds = initialDraft.photoDurations[index];
            if (seconds !== undefined) photoSeconds[jobId] = clampPhotoSeconds(seconds);
          });
          return { ...current, photoSeconds };
        });
      }
    })();
  }, [initialDraft, seedConsumed, uploads.addPickedMediaAndStartUploading]);
  const validationMessage = validateClipDraft(items, edits);
  const totalSeconds = totalClipSeconds(items, edits);

  const publish = usePublishPost({
    draftMediaItems: items,
    combinedUploadedFraction: uploads.combinedUploadedFraction,
    waitForAllDraftMediaIds: uploads.waitForAllDraftMediaIds,
    fillLocalPreviews: source === "video",
    onPublished,
    buildInput: (mediaIds) => {
      const trimmed = shiftMentionsAfterTrimmingStart(caption.text, caption.mentions);
      const { media, slideshow } = buildClipCreateFields(items, mediaIds, edits);
      return {
        text: trimmed.text,
        mentions: trimmed.mentions,
        audience: "everyone",
        kind: "clip",
        mediaIds,
        ...(actingProfileId ? { asProfileId: actingProfileId } : {}),
        ...(slideshow ? { slideshow } : { media }),
        ...(edits.look !== "none" ? { look: edits.look } : {}),
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
        afterTitle={<DraftsButton />}
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
          look={edits.look}
          onChangeLook={(look) => setEdits((current) => ({ ...current, look }))}
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
          onPublish={() => publish.publish()}
          onSaveDraft={
            onSaveDraft
              ? () =>
                  onSaveDraft({
                    text: caption.text,
                    mentions: caption.mentions,
                    soundId,
                    settings,
                    files: items.map((item) => ({
                      uri: item.previewUri,
                      mediaType: item.mediaType,
                      mimeType: null,
                      fileName: null,
                      sizeBytes: null,
                      width: item.width,
                      height: item.height,
                      durationSeconds: item.durationSeconds,
                    })),
                    photoDurations: items.map((item) => secondsForPhoto(edits, item.jobId)),
                    trim: edits.trim,
                    transition: edits.transition,
                    look: edits.look,
                  })
              : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
