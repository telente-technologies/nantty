import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { makeThemedStyles } from "@/theme";

import { truncateStickerText } from "./videoReply.util";

export const STICKER_BUBBLE_WIDTH = 220;

export interface CommentStickerBubbleProps {
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly text: string;
  readonly isDeleted?: boolean;
}

export function CommentStickerBubble({ username, avatarUrl, text, isDeleted }: CommentStickerBubbleProps) {
  const styles = useStyles();
  return (
    <View style={styles.bubble} accessible accessibilityLabel={isDeleted ? "Comment deleted" : `Comment by ${username}: ${truncateStickerText(text)}`}>
      <View style={styles.header}>
        <Avatar uri={avatarUrl} size={20} />
        <Text size={12} weight={600} lineHeight={14.4} numberOfLines={1} style={styles.username}>
          {`@${username}`}
        </Text>
      </View>
      <Text size={13} lineHeight={17} style={isDeleted ? styles.deleted : undefined}>
        {isDeleted ? "Comment deleted" : truncateStickerText(text)}
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  bubble: {
    width: STICKER_BUBBLE_WIDTH,
    padding: 10,
    gap: 6,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  username: { flex: 1 },
  deleted: { fontStyle: "italic", color: colors.textMuted },
}));
