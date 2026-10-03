import { Pressable, ScrollView, StyleSheet } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { Category } from "@/types";

export interface CategoryTabsProps {
  readonly categories: readonly Category[];
  readonly selectedCategoryId: string | null;
  readonly onSelectCategory: (categoryId: string | null) => void;
  readonly tone?: "neutral" | "primary";
  readonly background?: string;
}

export function CategoryTabs({ categories, selectedCategoryId, onSelectCategory, tone = "neutral", background: requestedBackground }: CategoryTabsProps) {
  const { colors } = useTheme();
  const background = requestedBackground ?? colors.surface;
  const tabs = [{ id: null, name: "All" }, ...categories.filter((c) => c.name !== "All")];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: background }} contentContainerStyle={styles.row}>
      {tabs.map((category) => {
        const selected = category.id === selectedCategoryId;
        const selectedBackground = tone === "primary" ? colors.primaryTint : colors.chip;
        const selectedText = tone === "primary" ? colors.primary : colors.text;
        return (
          <Pressable
            key={category.id ?? "all"}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelectCategory(category.id)}
            style={[styles.tab, { backgroundColor: selected ? selectedBackground : background }]}
          >
            <Text size={13} weight={500} lineHeight={16.9} color={selected ? selectedText : colors.textMuted}>
              {category.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, gap: 12 },
  tab: { height: 25, paddingHorizontal: 4, borderRadius: 4, justifyContent: "center" },
});
