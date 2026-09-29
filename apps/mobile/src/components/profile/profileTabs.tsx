import { Pressable, StyleSheet, View } from "react-native";

import { BrandBilibili20Icon, BuildingStore20Icon, MessageShare20Icon, Refresh20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export type ProfileTabKey = "posts" | "reposts" | "clips" | "store";

const TAB_DEFINITIONS: Record<ProfileTabKey, { label: string; icon: () => React.ReactNode }> = {
  posts: { label: "Posts", icon: () => <MessageShare20Icon /> },
  reposts: { label: "Reposts", icon: () => <Refresh20Icon /> },
  clips: { label: "Clips", icon: () => <BrandBilibili20Icon /> },
  store: { label: "Store", icon: () => <BuildingStore20Icon /> },
};

export interface ProfileTabsProps {
  readonly tabs: readonly ProfileTabKey[];
  readonly activeTab: ProfileTabKey;
  readonly onChangeTab: (tab: ProfileTabKey) => void;
}

export function ProfileTabs({ tabs, activeTab, onChangeTab }: ProfileTabsProps) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab === activeTab;
        const definition = TAB_DEFINITIONS[tab];
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityLabel={definition.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChangeTab(tab)}
            style={[styles.tab, active && styles.activeTab]}
          >
            {definition.icon()}
            {active && tab === "posts" ? (
              <Text size={14} lineHeight={16.8}>
                {definition.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 36, paddingHorizontal: 16, flexDirection: "row", gap: 8 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderBottomWidth: 1, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: colors.black },
});
