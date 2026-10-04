import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { HeadlineItem } from "@/types/explore.type";
import { formatCompactCount } from "@/utils/formatDate.util";

export interface HeadlineCardProps {
  readonly headline: HeadlineItem;
  readonly onPress: () => void;
}

export function HeadlineCard({ headline, onPress }: HeadlineCardProps) {
  const { colors } = useTheme();
  const themed = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${headline.title}. ${headline.sourceLabel}`} onPress={onPress} style={themed.card}>
      <View style={styles.text}>
        <Text size={12} color={colors.textSubtle}>{headline.categoryLabel} · {formatCompactCount(headline.postCount)} posts</Text>
        <Text size={15} weight={600} lineHeight={20} numberOfLines={3}>{headline.title}</Text>
        <Text size={13} lineHeight={18} color={colors.textMuted} numberOfLines={2}>{headline.summary}</Text>
        <Text size={11} weight={500} color={colors.textSubtle}>{headline.sourceLabel}</Text>
      </View>
      {headline.coverImageUrl ? <Image source={{ uri: headline.coverImageUrl }} style={styles.cover} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { flexDirection: "row", gap: 12, padding: 12, marginHorizontal: 16, borderRadius: 14, backgroundColor: colors.background, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
}));

const styles = StyleSheet.create({
  text: { flex: 1, gap: 4 },
  cover: { width: 76, height: 76, borderRadius: 10 },
});
