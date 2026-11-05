import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, type ScrollViewInstance } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { Category } from "@/types";
import { horizontalScrollGestureGuardProps } from "@/components/home/horizontalScrollGestureGuard.util";

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
  const scrollRef = useRef<ScrollViewInstance>(null);
  const rowWidth = useRef(0);
  const tabFrames = useRef(new Map<string, { x: number; width: number }>());
  const selectedKey = selectedCategoryId ?? "all";

  useEffect(() => {
    const frame = tabFrames.current.get(selectedKey);
    if (frame && rowWidth.current > 0) scrollRef.current?.scrollTo({ x: Math.max(0, frame.x + frame.width / 2 - rowWidth.current / 2), animated: true });
  }, [selectedKey]);

  return (
    <ScrollView
      ref={scrollRef}
      onLayout={(event) => { rowWidth.current = event.nativeEvent.layout.width; }}
      accessibilityRole="tablist"
      horizontal {...horizontalScrollGestureGuardProps} showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: background }} contentContainerStyle={styles.row}>
      {tabs.map((category) => {
        const selected = category.id === selectedCategoryId;
        const selectedBackground = tone === "primary" ? colors.primaryTint : colors.chip;
        const selectedText = tone === "primary" ? colors.primary : colors.text;
        return (
          <Pressable
            key={category.id ?? "all"}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={{ top: 10, bottom: 10 }}
            onPress={() => onSelectCategory(category.id)}
            onLayout={(event) => { tabFrames.current.set(category.id ?? "all", { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width }); }}
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
