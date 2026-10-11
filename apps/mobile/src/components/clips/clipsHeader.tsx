import { Pressable, StyleSheet, View } from "react-native";

import { MagnifyingGlass24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import type { ClipsFeedTab } from "@/types";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export interface ClipsHeaderProps {
  readonly tab: ClipsFeedTab;
  readonly onChangeTab: (tab: ClipsFeedTab) => void;
  readonly onSearch: () => void;
  readonly showTabs?: boolean;
  readonly foregroundColor?: string;
}

const CLIPS_FEED_TABS: readonly { readonly value: ClipsFeedTab; readonly label: string }[] = [
  { value: "forYou", label: "For You" },
  { value: "following", label: "Following" },
];

export function ClipsHeader({ tab, onChangeTab, onSearch, showTabs = true, foregroundColor }: ClipsHeaderProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.side} />
      {showTabs ? (
        <View style={styles.tabs} accessibilityRole="tablist">
          {CLIPS_FEED_TABS.map(({ value, label }) => {
            const selected = tab === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label} clips`}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                onPress={() => onChangeTab(value)}
                style={styles.tab}
              >
                <Text size={typeScale.md} weight={selected ? 700 : 500} lineHeight={20} color={foregroundColor} style={[styles.label, selected ? null : styles.inactive]}>
                  {label}
                </Text>
                <View style={[styles.indicator, { backgroundColor: selected ? foregroundColor ?? "#FFFFFF" : "transparent" }]} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.tabs} />
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="Search clips" hitSlop={12} onPress={onSearch} style={styles.side}>
        <MagnifyingGlass24Icon color={foregroundColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 48, paddingHorizontal: spacing[4], flexDirection: "row", alignItems: "center" },
  side: { width: 24, alignItems: "center" },
  tabs: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing[5] },
  tab: { alignItems: "center", paddingTop: 6 },
  label: { textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  inactive: { opacity: 0.7 },
  indicator: { marginTop: 4, width: 22, height: 3, borderRadius: 2 },
});
