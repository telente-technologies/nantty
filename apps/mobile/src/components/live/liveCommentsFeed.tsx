import { ScrollView, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { LiveComment } from "@/types";

const describeLiveComment = (comment: LiveComment) =>
  comment.kind === "joined" ? `joined ${comment.text}` : comment.kind === "reply" ? `replied ${comment.text}` : comment.text;

export function LiveCommentsFeed({ comments }: { comments: readonly LiveComment[] }) {
  return (
    <ScrollView style={styles.feed} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {comments.slice(-8).map((comment) => (
        <View key={comment.id} style={styles.row}>
          <Avatar uri={comment.author.avatarUrl} size={24} placeholderColor={colors.placeholder} />
          <Text size={13} lineHeight={16.9} style={styles.text}>
            <Text size={13} lineHeight={16.9} color={colors.textMuted}>
              @{comment.author.username}
            </Text>{" "}
            {describeLiveComment(comment)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  feed: { maxHeight: 150, width: 315 },
  content: { gap: 10, justifyContent: "flex-end", flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  text: { flex: 1 },
});
