import { Modal, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Cancel20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

import { CommentComposer } from "./commentComposer";
import { CommentThreadContext, useCommentThreadController } from "./commentThreadController.hook";
import { ThreadedCommentList } from "./threadedCommentList";

export interface ClipCommentsSheetProps {
  readonly postId: string | null;
  readonly myAvatarUrl: string | null;
  readonly onClose: () => void;
}

export function ClipCommentsSheet({ postId, myAvatarUrl, onClose }: ClipCommentsSheetProps) {
  const insets = useSafeAreaInsets();
  const commentThread = useCommentThreadController(postId);

  return (
    <Modal visible={!!postId} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <CommentThreadContext.Provider value={commentThread}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable accessibilityLabel="Close comments" style={styles.backdrop} onPress={onClose} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]} accessibilityViewIsModal>
            <View style={styles.titleRow}>
              <Text size={16} weight={600} lineHeight={19.2} accessibilityRole="header">
                Comments
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose}>
                <Cancel20Icon />
              </Pressable>
            </View>
            {postId ? <ThreadedCommentList contentContainerStyle={styles.list} /> : <View style={styles.flexFill} />}
            <CommentComposer
              myAvatarUrl={myAvatarUrl}
              replyTarget={commentThread.replyTarget}
              onCancelReply={commentThread.cancelReplyingToComment}
              onSubmit={commentThread.submitCommentOrReplyText}
            />
          </View>
        </KeyboardAvoidingView>
      </CommentThreadContext.Provider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: "flex-end" },
  flexFill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    height: 566,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.divider,
    overflow: "hidden",
  },
  titleRow: { paddingHorizontal: 16, paddingTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  list: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 },
});
