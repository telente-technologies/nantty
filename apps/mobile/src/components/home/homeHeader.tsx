import { Pressable, StyleSheet, View } from "react-native";

import { Bell24Icon, MagnifyingGlass24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export type HomeSection = "feed" | "mart";

export interface HomeHeaderProps {
  readonly activeSection: HomeSection;
  readonly onChangeSection: (section: HomeSection) => void;
  readonly onPressSearch: () => void;
  readonly onPressNotifications: () => void;
}

export function HomeHeader({ activeSection, onChangeSection, onPressSearch, onPressNotifications }: HomeHeaderProps) {
  const sectionTab = (section: HomeSection, label: string) => {
    const active = activeSection === section;
    return (
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChangeSection(section)} hitSlop={8}>
        <Text size={18} weight={active ? 600 : 500} lineHeight={21.6} letterSpacing={-0.36} color={active ? colors.primary : colors.textSubtle}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.bar}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {sectionTab("feed", "Feed")}
        {sectionTab("mart", "Mart")}
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Search" hitSlop={10} onPress={onPressSearch}>
          <MagnifyingGlass24Icon />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={10} onPress={onPressNotifications}>
          <Bell24Icon />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tabs: { flexDirection: "row", alignItems: "center", gap: 8 },
  actions: { flexDirection: "row", alignItems: "center", gap: 16 },
});
