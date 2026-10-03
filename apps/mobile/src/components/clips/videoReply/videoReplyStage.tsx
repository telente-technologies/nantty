import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { MediaPager } from "@/components/feed/mediaPager";
import { convertDraftItemsToPreviewMedia, type PostDraftMediaItem } from "@/components/create/postDraftUploads.hook";
import { Text } from "@/components/ui/text";
import { makeThemedStyles } from "@/theme";
import type { CommentStickerLayout, PostAudience } from "@/types";

import { DraggableCommentSticker } from "./draggableCommentSticker";
import { STICKER_MAX_SCALE, STICKER_MIN_SCALE, clampStickerLayout, isAudienceBroaderThanOriginal, type VideoReplyTarget } from "./videoReply.util";

const STAGE_HEIGHT = 360;
const SIZE_STEP = 0.2;

export interface VideoReplyStageProps {
  readonly target: VideoReplyTarget;
  readonly draftMediaItems: readonly PostDraftMediaItem[];
  readonly layout: CommentStickerLayout;
  readonly audience: PostAudience;
  readonly onChangeLayout: (layout: CommentStickerLayout) => void;
}

export function VideoReplyStage({ target, draftMediaItems, layout, audience, onChangeLayout }: VideoReplyStageProps) {
  const styles = useStyles();
  const [stageWidth, setStageWidth] = useState(0);
  const resizeBy = (delta: number) => onChangeLayout(clampStickerLayout({ ...layout, scale: layout.scale + delta }));
  const showsAudienceWarning = isAudienceBroaderThanOriginal(audience, target.originalAudience);
  return (
    <View style={styles.root}>
      <View style={styles.stage} onLayout={(event) => setStageWidth(event.nativeEvent.layout.width)}>
        {draftMediaItems.length > 0 ? (
          <MediaPager media={convertDraftItemsToPreviewMedia(draftMediaItems)} height={STAGE_HEIGHT} />
        ) : (
          <View style={styles.empty}>
            <Text size={13} lineHeight={17} align="center" style={styles.emptyText}>
              Record or pick your video reply
            </Text>
          </View>
        )}
        {stageWidth > 0 && !layout.hidden ? (
          <DraggableCommentSticker
            username={target.commenterUsername}
            avatarUrl={target.commenterAvatarUrl}
            text={target.text}
            layout={layout}
            stageWidth={stageWidth}
            stageHeight={STAGE_HEIGHT}
            onChangeLayout={onChangeLayout}
          />
        ) : null}
      </View>
      <View style={styles.controls}>
        <Text size={12} weight={600} lineHeight={16} accessibilityRole="button" accessibilityLabel="Make comment smaller" disabled={layout.scale <= STICKER_MIN_SCALE} onPress={() => resizeBy(-SIZE_STEP)}>
          Smaller
        </Text>
        <Text size={12} weight={600} lineHeight={16} accessibilityRole="button" accessibilityLabel="Make comment larger" disabled={layout.scale >= STICKER_MAX_SCALE} onPress={() => resizeBy(SIZE_STEP)}>
          Larger
        </Text>
        <Text size={12} weight={600} lineHeight={16} accessibilityRole="button" onPress={() => onChangeLayout({ ...layout, hidden: !layout.hidden })}>
          {layout.hidden ? "Show comment" : "Hide comment"}
        </Text>
      </View>
      {showsAudienceWarning ? (
        <View style={styles.warning} accessibilityLiveRegion="polite">
          <Text size={12} lineHeight={16.8} style={styles.warningText}>
            The original clip is not public. Posting this reply to everyone shows the comment to a wider audience than the original.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 12 },
  stage: { height: STAGE_HEIGHT, borderRadius: 16, overflow: "hidden", backgroundColor: colors.sunken },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: colors.textMuted },
  controls: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 },
  warning: { padding: 10, borderRadius: 10, backgroundColor: colors.cautionTint },
  warningText: { color: colors.cautionText },
}));
