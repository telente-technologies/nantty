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

export function ClipsHeader({ tab, onChangeTab, onSearch, showTabs = true, foregroundColor }: ClipsHeaderProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.side} />
      {showTabs ? (
        <View style={styles.tabs} accessibilityRole="tablist">
          {(["forYou", "following"] as const).map((value) => (
            <Text
              key={value}
              size={typeScale.md}
              weight={tab === value ? 600 : 400}
              lineHeight={16.8}
              color={foregroundColor}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
              onPress={() => onChangeTab(value)}
            >
              {value === "forYou" ? "For You" : "Following"}
            </Text>
          ))}
        </View>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Search clips" hitSlop={12} onPress={onSearch}>
        <MagnifyingGlass24Icon color={foregroundColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 48, paddingHorizontal: spacing[4], flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { width: 24 },
  tabs: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: spacing[3], zIndex: -1 },
});
