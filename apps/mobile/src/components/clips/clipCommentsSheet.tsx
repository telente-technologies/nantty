import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Cancel20Icon, VideoCamera24Icon } from "@/components/icons";
import { KeyboardSpacer } from "@/components/ui/keyboardSpacer";
import { Text } from "@/components/ui/text";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { useAuthStore } from "@/store/auth.store";
import { makeThemedStyles } from "@/theme";
import type { Clip } from "@/types";

import { CommentComposer } from "./commentComposer";
import { CommentThreadContext, useCommentThreadController } from "./commentThreadController.hook";
import { buildVideoReplyTarget } from "./videoReply/videoReply.util";
import { ThreadedCommentList } from "./threadedCommentList";
import { FrameAwareModal } from "@/components/ui/frameAwareModal";

const SHEET_HEIGHT = 566;
const SHEET_TOP_GAP = 12;

export interface ClipCommentsSheetProps {
  readonly postId: string | null;
  readonly myAvatarUrl: string | null;
  readonly clip?: Clip | null;
  readonly highlightCommentId?: string | null;
  readonly onClose: () => void;
}

export function ClipCommentsSheet({ postId, myAvatarUrl, clip, highlightCommentId, onClose }: ClipCommentsSheetProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const commentThread = useCommentThreadController(postId, onClose, {
    clipAuthorId: clip?.author.id,
    onStartVideoReply: (comment) => {
      if (!clip) return;
      onClose();
      navigation.navigate("CreatePost", { mode: "clip", videoReply: buildVideoReplyTarget(comment, clip) });
    },
  });
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const isClipAuthor = !!clip && !!signedInUserId && clip.author.id === signedInUserId;

  const { setHighlightedCommentId } = commentThread;
  useEffect(() => {
    if (!postId || !highlightCommentId) return;
    setHighlightedCommentId(highlightCommentId);
    const timer = setTimeout(() => setHighlightedCommentId(null), 6000);
    return () => clearTimeout(timer);
  }, [postId, highlightCommentId, setHighlightedCommentId]);

  useEffect(() => navigation.addListener("blur", onClose), [navigation, onClose]);

  return (
    <FrameAwareModal visible={!!postId} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <CommentThreadContext.Provider value={commentThread}>
        <View style={[styles.root, { paddingTop: insets.top + SHEET_TOP_GAP }]}>
          <Pressable accessibilityLabel="Close comments" style={styles.backdrop} onPress={onClose} />
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.titleRow}>
              <Text size={16} weight={600} lineHeight={19.2} accessibilityRole="header">
                Comments
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose}>
                <Cancel20Icon />
              </Pressable>
            </View>
            {isClipAuthor ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: commentThread.isPickingVideoReplyComment }}
                onPress={() => commentThread.setIsPickingVideoReplyComment(!commentThread.isPickingVideoReplyComment)}
                style={styles.videoReplyButton}
              >
                <VideoCamera24Icon size={16} />
                <Text size={13} weight={600} lineHeight={16}>
                  {commentThread.isPickingVideoReplyComment ? "Tap a comment to reply with video" : "Reply with video"}
                </Text>
              </Pressable>
            ) : null}
            {postId ? <ThreadedCommentList contentContainerStyle={styles.list} /> : <View style={styles.flexFill} />}
            <CommentComposer
              avoidKeyboard={false}
              myAvatarUrl={myAvatarUrl}
              replyTarget={commentThread.replyTarget}
              onCancelReply={commentThread.cancelReplyingToComment}
              onSubmit={commentThread.submitCommentOrReplyText}
            />
          </View>
          <KeyboardSpacer style={styles.keyboardArea} />
        </View>
      </CommentThreadContext.Provider>
    </FrameAwareModal>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  flexFill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    height: SHEET_HEIGHT,
    flexShrink: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.divider,
    overflow: "hidden",
  },
  videoReplyButton: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.chip },
  keyboardArea: { backgroundColor: colors.surface },
  titleRow: { paddingHorizontal: 16, paddingTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  list: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 },
}));
