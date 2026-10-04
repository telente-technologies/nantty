import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { TrendItem } from "@/types/explore.type";
import { formatCompactCount } from "@/utils/formatDate.util";

export interface TrendRowProps {
  readonly trend: TrendItem;
  readonly onPress: () => void;
}

export function TrendRow({ trend, onPress }: TrendRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${trend.label}, ${trend.postCount} posts`} onPress={onPress} style={styles.row}>
      <View style={styles.text}>
        <Text size={12} color={colors.textSubtle}>{trend.rank} · {trend.context}</Text>
        <Text size={15} weight={600}>{trend.label}</Text>
        <Text size={12} color={colors.textSubtle}>{formatCompactCount(trend.postCount)} posts</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 10 },
  text: { gap: 2 },
});
