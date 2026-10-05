import { Pressable, StyleSheet, View } from "react-native";

import { Cancel20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { RecentSearchEntry } from "@/types/search.type";

export interface RecentSearchListProps {
  readonly entries: readonly RecentSearchEntry[];
  readonly onSelect: (query: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onClear: () => void;
}

export function RecentSearchList({ entries, onSelect, onRemove, onClear }: RecentSearchListProps) {
  const { colors } = useTheme();
  if (entries.length === 0) return null;
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text size={15} weight={600}>Recent</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onClear}>
          <Text size={13} weight={500} color={colors.link}>Clear all</Text>
        </Pressable>
      </View>
      {entries.map((entry) => (
        <View key={entry.id} style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Search ${entry.query}`} onPress={() => onSelect(entry.query)} style={styles.query}>
            <Text size={14} numberOfLines={1}>{entry.query}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${entry.query} from recent searches`} hitSlop={8} onPress={() => onRemove(entry.id)}>
            <Cancel20Icon size={16} color={colors.textSubtle} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, paddingTop: 12, gap: 4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  query: { flex: 1 },
});
