import { StyleSheet, View, Pressable } from "react-native";

import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { Post } from "@/types";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";

import { MediaPager } from "./mediaPager";

export interface ResharedPostBlockProps {
  readonly original: Post;
  readonly onPressAuthor?: () => void;
  readonly onPress?: () => void;
}

export function ResharedPostBlock({ original, onPressAuthor, onPress }: ResharedPostBlockProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open post by ${original.author.name}`} disabled={!onPress} onPress={onPress} style={styles.block}>
      <Pressable accessibilityRole="button" disabled={!onPressAuthor} onPress={onPressAuthor} style={styles.header}>
        <Avatar uri={original.author.avatarUrl} size={24} />
        <Text size={13} weight={500} lineHeight={15.6}>
          {original.author.name}
        </Text>
        <VerificationBadge verification={original.author.verification} legacyVerified={original.author.verified} size={14} />
        <View style={styles.dot} />
        <Text size={13} weight={500} lineHeight={15.6}>
          {formatTimeSincePosted(original.createdAt)}
        </Text>
      </Pressable>

      {original.text ? (
        <Text size={14} lineHeight={16.8}>
          {original.text}
        </Text>
      ) : null}

      {original.media.length > 0 ? <MediaPager media={original.media} isVisibleOnScreen={false} /> : null}

      <Text size={12} lineHeight={14.4} color={colors.textSubtle}>
        {formatCountWithThousandsSuffix(original.likes)} likes · {formatCountWithThousandsSuffix(original.comments)} comments ·{" "}
        {formatCountWithThousandsSuffix(original.reposts)} reposts
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    marginHorizontal: 16,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.avatar },
});
