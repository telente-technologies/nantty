import { useRef } from "react";
import { FlatList, Modal, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, type TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Cancel20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

import { CommentComposer } from "./commentComposer";
import { CommentRow } from "./commentRow";
import { usePostCommentsWithActions } from "./postComments.hook";

export interface ClipCommentsSheetProps {
  readonly postId: string | null;
  readonly myAvatarUrl: string | null;
  readonly onClose: () => void;
}

export function ClipCommentsSheet({ postId, myAvatarUrl, onClose }: ClipCommentsSheetProps) {
  const insets = useSafeAreaInsets();
  const composerRef = useRef<TextInput>(null);
  const { comments, addComment, toggleCommentLike } = usePostCommentsWithActions(postId);

  return (
    <Modal visible={!!postId} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
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
          <FlatList
            data={comments.data?.data ?? []}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.gap} />}
            renderItem={({ item }) => (
              <CommentRow
                comment={item}
                onToggleLike={() => toggleCommentLike.mutate(item)}
                onReply={() => composerRef.current?.focus()}
              />
            )}
          />
          <CommentComposer ref={composerRef} myAvatarUrl={myAvatarUrl} onSubmit={(text) => addComment.mutate(text)} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: "flex-end" },
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
  gap: { height: 20 },
});
