import { ScrollView, StyleSheet } from "react-native";

import { Chip } from "@/components/ui/chip";
import type { ExploreCategory, ExploreCategoryId } from "@/types/explore.type";

export const DEFAULT_EXPLORE_CATEGORIES: readonly ExploreCategory[] = [
  { id: "for_you", label: "For you" }, { id: "trending", label: "Trending" }, { id: "news", label: "News" }, { id: "sports", label: "Sports" },
  { id: "entertainment", label: "Entertainment" }, { id: "music", label: "Music" }, { id: "tech", label: "Tech" }, { id: "business", label: "Business" },
  { id: "fashion", label: "Fashion" }, { id: "gaming", label: "Gaming" }, { id: "comedy", label: "Comedy" }, { id: "religion", label: "Religion" },
  { id: "food", label: "Food" }, { id: "politics", label: "Politics" }, { id: "lifestyle", label: "Lifestyle" },
];

export interface ExploreCategoryTabsProps {
  readonly categories: readonly ExploreCategory[];
  readonly selected: ExploreCategoryId;
  readonly onSelect: (category: ExploreCategoryId) => void;
}

export function ExploreCategoryTabs({ categories, selected, onSelect }: ExploreCategoryTabsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
      {categories.map((category) => (
        <Chip key={category.id} kind="filter" label={category.label} selected={category.id === selected} onPress={() => onSelect(category.id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ row: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 } });
