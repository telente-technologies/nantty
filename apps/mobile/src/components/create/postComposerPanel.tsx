import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { CreateMode, ID, PostAudience } from "@/types";
import type { MentionEntity } from "@/types/mention.type";

import { useCaptionField, FREE_POST_TEXT_LIMIT, PREMIUM_POST_TEXT_LIMIT } from "./captionField.hook";
import { useAuthStore } from "@/store/auth.store";
import { CreateModePill } from "./createModePill";
import { DismissKeyboardScrollView } from "./dismissKeyboardScrollView";
import { DraftMediaStrip } from "./draftMediaStrip";
import { MAXIMUM_MEDIA_PER_POST, pickPhotosAndVideosFromLibrary, takePhotoWithSystemCamera } from "./pickMedia.util";
import type { PostDraftMediaItem } from "./postDraftUploads.hook";
import { PostToolbar } from "./postToolbar";
import { PostSettingsStep } from "./settings/postSettingsStep";
import type { PostSettingsValue } from "./settings/postSettings.type";

export interface PostComposerDraft extends PostSettingsValue {
  readonly text: string;
  readonly mentions: readonly MentionEntity[];
  readonly audience: PostAudience;
  readonly kind: "clip" | "video" | "photo";
}

export interface PostComposerPanelProps {
  readonly stage: "compose" | "settings";
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
  readonly onSaveDraft?: () => void;
  readonly soundPicker?: ReactNode;
  readonly videoReplyStage?: ReactNode;
  readonly quotePreview?: ReactNode;
}

const describeDraftMedia = (items: readonly PostDraftMediaItem[]) => {
  if (items.length === 0) return null;
  const videos = items.filter((item) => item.mediaType === "video").length;
  const photos = items.length - videos;
  return [photos ? `${photos} ${photos === 1 ? "photo" : "photos"}` : null, videos ? `${videos} ${videos === 1 ? "video" : "videos"}` : null].filter(Boolean).join(", ");
};

export function PostComposerPanel(props: PostComposerPanelProps) {
  const { draft, onChangeDraft, draftMediaItems, onAddPickedMedia, videoReplyStage } = props;
  const { colors } = useTheme();
  const styles = useStyles();
  const isPremium = useAuthStore((s) => s.user?.isPremium ?? false);
  const caption = useCaptionField({
    text: draft.text,
    mentions: draft.mentions,
    placeholder: "What’s happening?",
    onChange: (text, mentions) => onChangeDraft({ ...draft, text, mentions }),
    maxLength: isPremium ? PREMIUM_POST_TEXT_LIMIT : FREE_POST_TEXT_LIMIT,
    showCount: true,
  });
  const remainingMediaSlots = MAXIMUM_MEDIA_PER_POST - draftMediaItems.length;

  if (props.stage === "settings") {
    return (
      <PostSettingsStep
        value={draft}
        onChange={(settings) => onChangeDraft({ ...draft, ...settings })}
        caption={draft.text}
        mentions={draft.mentions}
        thumbnailUri={draftMediaItems[0]?.previewUri ?? null}
        mediaSummary={describeDraftMedia(draftMediaItems)}
        preview={videoReplyStage}
        quotePreview={props.quotePreview}
        publishing={props.publishing}
        publishButtonTitle={props.publishButtonTitle}
        publishErrorMessage={props.publishErrorMessage}
        onPublish={props.onPublish}
        onSaveDraft={props.onSaveDraft}
      />
    );
  }

  return (
    <View style={styles.flex}>
      <DismissKeyboardScrollView contentContainerStyle={styles.compose}>
        {caption.input}
        {props.quotePreview ?? null}
        {videoReplyStage ?? null}
        <DraftMediaStrip items={draftMediaItems} maximumItems={MAXIMUM_MEDIA_PER_POST} onRemoveItem={props.onRemoveDraftMedia} />
        {props.validationHint ? (
          <Text size={12} lineHeight={16.8} color={colors.error} accessibilityLiveRegion="polite">
            {props.validationHint}
          </Text>
        ) : null}
        {props.soundPicker}
      </DismissKeyboardScrollView>
      {caption.suggestions}
      {caption.focused || videoReplyStage ? null : (
        <View style={styles.pill}>
          <CreateModePill mode={props.mode} onChangeMode={props.onChangeMode} />
        </View>
      )}
      <PostToolbar
        audience={draft.audience}
        isKeyboardOpen={caption.focused}
        onToggleAudience={() => onChangeDraft({ ...draft, audience: draft.audience === "everyone" ? "followers" : "everyone" })}
        onTakePhoto={async () => {
          if (remainingMediaSlots > 0) onAddPickedMedia(await takePhotoWithSystemCamera());
        }}
        onPickFromLibrary={async () => onAddPickedMedia(await pickPhotosAndVideosFromLibrary(remainingMediaSlots))}
      />
    </View>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  compose: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24, gap: 16 },
  pill: { paddingBottom: 29 },
}));
