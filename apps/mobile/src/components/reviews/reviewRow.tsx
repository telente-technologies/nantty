import { StyleSheet, View } from "react-native";

import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { Check16Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ProductReview } from "@/types/commerce.type";

import { StarRating } from "./starRating";

export function ReviewRow({ review, isOwn, onDelete }: { review: ProductReview; isOwn?: boolean; onDelete?: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.review}>
      <View style={styles.author}>
        <Avatar uri={review.author.avatarUrl ?? null} size={32} />
        <View style={styles.authorText}>
          <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1}>
            {isOwn ? "Your review" : review.author.name || review.author.username}
          </Text>
          <StarRating rating={review.rating} />
        </View>
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>{formatFriendlyDate(review.createdAt)}</Text>
      </View>
      {review.isVerifiedPurchase ? (
        <View style={styles.verified} accessible accessibilityLabel="Verified purchase">
          <Check16Icon size={12} color={colors.successText} />
          <Text size={12} weight={500} lineHeight={14.4} color={colors.successText}>Verified purchase</Text>
        </View>
      ) : null}
      {review.title ? <Text size={14} weight={600} lineHeight={18}>{review.title}</Text> : null}
      <Text size={13} lineHeight={18.2} color={colors.textMuted}>{review.text}</Text>
      {review.reply ? (
        <View style={styles.reply}>
          <Text size={12} weight={600} lineHeight={16.8}>Reply from {review.reply.authorName || "the seller"}</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>{review.reply.body}</Text>
        </View>
      ) : null}
      {isOwn && onDelete ? (
        <Text size={12} weight={500} lineHeight={16.8} color={colors.error} accessibilityRole="button" onPress={onDelete} style={styles.delete}>
          Delete my review
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  review: { paddingVertical: 16, gap: 8 },
  author: { flexDirection: "row", alignItems: "center", gap: 8 },
  authorText: { flex: 1, gap: 2 },
  verified: { flexDirection: "row", alignItems: "center", gap: 4 },
  reply: { backgroundColor: colors.surface, borderRadius: 8, padding: 10, gap: 4 },
  delete: { alignSelf: "flex-start", paddingVertical: 4 },
}));
