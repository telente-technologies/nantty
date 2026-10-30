import { Pressable, StyleSheet, View } from "react-native";

import { BrandBilibili20Icon, BuildingStore20Icon, LockSimple24Icon, MessageShare20Icon, Refresh20Icon, SpeakerHigh24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles } from "@/theme";

export type ProfileTabKey = "posts" | "reposts" | "clips" | "subscribers" | "sounds" | "store";

const TAB_DEFINITIONS: Record<ProfileTabKey, { label: string; accessibilityLabel: string; icon: () => React.ReactNode }> = {
  posts: { label: "Posts", accessibilityLabel: "Posts", icon: () => <MessageShare20Icon /> },
  reposts: { label: "Reposts", accessibilityLabel: "Reposts", icon: () => <Refresh20Icon /> },
  clips: { label: "Clips", accessibilityLabel: "Clips", icon: () => <BrandBilibili20Icon /> },
  subscribers: { label: "Subs", accessibilityLabel: "Subscriber posts", icon: () => <LockSimple24Icon size={20} /> },
  sounds: { label: "Sounds", accessibilityLabel: "Sounds", icon: () => <SpeakerHigh24Icon size={20} /> },
  store: { label: "Store", accessibilityLabel: "Store", icon: () => <BuildingStore20Icon /> },
};

export interface ProfileTabsProps {
  readonly tabs: readonly ProfileTabKey[];
  readonly activeTab: ProfileTabKey;
  readonly onChangeTab: (tab: ProfileTabKey) => void;
}

export function ProfileTabs({ tabs, activeTab, onChangeTab }: ProfileTabsProps) {
  const styles = useStyles();
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab === activeTab;
        const definition = TAB_DEFINITIONS[tab];
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityLabel={definition.accessibilityLabel}
            accessibilityState={{ selected: active }}
            onPress={() => onChangeTab(tab)}
            style={[styles.tab, active && styles.activeTab]}
          >
            {definition.icon()}
            {active ? (
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

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { height: 44, paddingHorizontal: 12, flexDirection: "row", gap: 4 },
  tab: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: colors.black },
}));
