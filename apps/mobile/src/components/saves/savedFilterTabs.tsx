import { Pressable, ScrollView, StyleSheet } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { SavedItemFilter } from "@/types";

export const SAVED_ITEM_FILTERS: readonly { readonly value: SavedItemFilter; readonly label: string }[] = [
  { value: "all", label: "All" },
  { value: "post", label: "Posts" },
  { value: "video", label: "Videos" },
  { value: "clip", label: "Clips" },
  { value: "product", label: "Products" },
  { value: "comment", label: "Replies" },
];

export interface SavedFilterTabsProps {
  readonly selectedFilter: SavedItemFilter;
  readonly onSelectFilter: (filter: SavedItemFilter) => void;
}

export function SavedFilterTabs({ selectedFilter, onSelectFilter }: SavedFilterTabsProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bar} contentContainerStyle={styles.row} accessibilityRole="tablist">
      {SAVED_ITEM_FILTERS.map((filter) => {
        const selected = filter.value === selectedFilter;
        return (
          <Pressable
            key={filter.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelectFilter(filter.value)}
            hitSlop={{ top: 10, bottom: 10 }}
            style={[styles.tab, selected && styles.selectedTab]}
          >
            <Text size={13} weight={500} lineHeight={16.9} color={selected ? colors.text : colors.textMuted}>
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    bar: { flexGrow: 0, backgroundColor: colors.surface },
    row: { paddingVertical: 12, paddingLeft: 16, paddingRight: 12, gap: 8 },
    tab: { height: 25, paddingHorizontal: 8, borderRadius: 4, justifyContent: "center", backgroundColor: colors.surface },
    selectedTab: { backgroundColor: colors.chip },
  }),
);
