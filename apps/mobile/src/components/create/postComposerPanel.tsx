import { useRef, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";

import { MediaPager } from "@/components/feed/mediaPager";
import { useMentionComposer } from "@/components/mentions/mentionComposer.hook";
import { MentionCountLabel, MentionSuggestionList } from "@/components/mentions/mentionSuggestionList";
import { MentionText } from "@/components/mentions/mentionText";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import type { CreateMode, ID, PostAudience } from "@/types";
import type { MentionEntity } from "@/types/mention.type";

import { AiGeneratedToggleRow } from "./aiGeneratedToggleRow";
import { PostAudienceSettings, type PostAudienceSettingsValue } from "./postAudienceSettings";
import { CreateModePill } from "./createModePill";
import { DraftMediaStrip } from "./draftMediaStrip";
import { MAXIMUM_MEDIA_PER_POST, pickPhotosAndVideosFromLibrary, takePhotoWithSystemCamera } from "./pickMedia.util";
import { convertDraftItemsToPreviewMedia, type PostDraftMediaItem } from "./postDraftUploads.hook";
import { PostToolbar } from "./postToolbar";

export interface PostComposerDraft {
  readonly text: string;
  readonly mentions: readonly MentionEntity[];
  readonly audience: PostAudience;
  readonly kind: "clip" | "video" | "photo";
  readonly isAiGenerated: boolean;
  readonly audienceSettings: PostAudienceSettingsValue;
}

export interface PostComposerPanelProps {
  readonly stage: "compose" | "preview";
  readonly mode: CreateMode;
  readonly draft: PostComposerDraft;
  readonly onChangeDraft: (draft: PostComposerDraft) => void;
  readonly draftMediaItems: readonly PostDraftMediaItem[];
  readonly onAddPickedMedia: (files: Awaited<ReturnType<typeof takePhotoWithSystemCamera>>) => void;
  readonly onRemoveDraftMedia: (jobId: ID) => void;
  readonly onChangeMode: (mode: CreateMode) => void;
  readonly publishing: boolean;
  readonly publishButtonTitle: string;
  readonly publishErrorMessage: string | null;
  readonly validationHint: string | null;
  readonly onPublish: () => void;
  readonly soundPicker?: ReactNode;
  readonly videoReplyStage?: ReactNode;
}

export function PostComposerPanel({
  stage,
  mode,
  draft,
  onChangeDraft,
  draftMediaItems,
  onAddPickedMedia,
  onRemoveDraftMedia,
  onChangeMode,
  publishing,
  publishButtonTitle,
  publishErrorMessage,
  validationHint,
  onPublish,
  soundPicker,
  videoReplyStage,
}: PostComposerPanelProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const mentionComposer = useMentionComposer({
    surface: "post",
    text: draft.text,
    mentions: draft.mentions,
    inputRef,
    signInReason: "post",
    onChange: (text, mentions) => onChangeDraft({ ...draft, text, mentions }),
  });
  const remainingMediaSlots = MAXIMUM_MEDIA_PER_POST - draftMediaItems.length;
  const toggleAudience = () => onChangeDraft({ ...draft, audience: draft.audience === "everyone" ? "followers" : "everyone" });

  if (stage === "preview") {
    return (
      <ScrollView contentContainerStyle={styles.preview}>
        {draft.text ? (
          <MentionText text={draft.text} mentions={draft.mentions} size={14} lineHeight={16.8} />
        ) : null}
        {videoReplyStage ?? null}
        {!videoReplyStage && draftMediaItems.length > 0 ? (
          <View style={styles.previewMedia}>
            <MediaPager media={convertDraftItemsToPreviewMedia(draftMediaItems)} height={335} />
          </View>
        ) : null}
        {publishErrorMessage ? (
          <Text size={13} lineHeight={16.9} color={colors.error} accessibilityLiveRegion="polite">
            {publishErrorMessage}
          </Text>
        ) : null}
        <Button title={publishButtonTitle} disabled={publishing} onPress={onPublish} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.compose} keyboardShouldPersistTaps="handled">
        <TextInput
          ref={inputRef}
          {...mentionComposer.inputProps}
          onFocus={() => {
            mentionComposer.inputProps.onFocus();
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          placeholder="What’s happening?"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          multiline
          autoFocus
          maxLength={2000}
          accessibilityLabel="What’s happening?"
          style={styles.input}
        />
        <MentionCountLabel mentionCount={mentionComposer.mentionCount} />
        {videoReplyStage ?? null}
        <DraftMediaStrip items={draftMediaItems} maximumItems={MAXIMUM_MEDIA_PER_POST} onRemoveItem={onRemoveDraftMedia} />
        {validationHint ? (
          <Text size={12} lineHeight={16.8} color={colors.error} accessibilityLiveRegion="polite">
            {validationHint}
          </Text>
        ) : null}
        {soundPicker}
        <AiGeneratedToggleRow value={draft.isAiGenerated} onChange={(isAiGenerated) => onChangeDraft({ ...draft, isAiGenerated })} />
        <PostAudienceSettings value={draft.audienceSettings} onChange={(audienceSettings) => onChangeDraft({ ...draft, audienceSettings })} />
      </ScrollView>
      {mentionComposer.suggestions ? <MentionSuggestionList suggestions={mentionComposer.suggestions} /> : null}
      {focused || videoReplyStage ? null : (
        <View style={styles.pill}>
          <CreateModePill mode={mode} onChangeMode={onChangeMode} />
        </View>
      )}
      <PostToolbar
        audience={draft.audience}
        onToggleAudience={toggleAudience}
        onTakePhoto={async () => {
          if (remainingMediaSlots > 0) onAddPickedMedia(await takePhotoWithSystemCamera());
        }}
        onPickFromLibrary={async () => onAddPickedMedia(await pickPhotosAndVideosFromLibrary(remainingMediaSlots))}
        onEditMedia={async () => onAddPickedMedia(await pickPhotosAndVideosFromLibrary(Math.min(remainingMediaSlots, 1)))}
        onAddLocation={() => undefined}
      />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  compose: { paddingHorizontal: 16, paddingTop: 32, gap: 16 },
  input: {
    minHeight: 120,
    padding: 0,
    textAlignVertical: "top",
    fontFamily: fontFamily[400],
    fontSize: 16,
    lineHeight: 19.2,
    letterSpacing: calculateDefaultLetterSpacing(16),
    color: colors.text,
  },
  pill: { paddingBottom: 29 },
  preview: { paddingHorizontal: 16, paddingTop: 20, gap: 24, paddingBottom: 40 },
  previewMedia: { marginHorizontal: -16, overflow: "hidden" },
}));
