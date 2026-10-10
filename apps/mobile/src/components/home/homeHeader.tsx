import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { ZudomartLogoMark, ZudomartWordmark } from "@/components/brand/zudomartWordmark";
import { Bell24Icon, MagnifyingGlass24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

import { CartHeaderButtonShownOnlyWhenCartHasItems } from "./cartHeaderButton";

export type HomeSection = "feed" | "mart";

const FULL_WORDMARK_MIN_WIDTH = 380;

export interface HomeHeaderProps {
  readonly activeSection: HomeSection;
  readonly onChangeSection: (section: HomeSection) => void;
  readonly onPressSearch: () => void;
  readonly onPressNotifications: () => void;
}

export function HomeHeader({ activeSection, onChangeSection, onPressSearch, onPressNotifications }: HomeHeaderProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
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
      <View style={styles.wordmark} pointerEvents="none">
        {width >= FULL_WORDMARK_MIN_WIDTH ? <ZudomartWordmark height={20} /> : <ZudomartLogoMark size={24} />}
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Search" hitSlop={10} onPress={onPressSearch}>
          <MagnifyingGlass24Icon />
        </Pressable>
        <CartHeaderButtonShownOnlyWhenCartHasItems />
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={10} onPress={onPressNotifications}>
          <Bell24Icon />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  bar: {
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lead: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  divider: { width: StyleSheet.hairlineWidth * 2, height: 16, borderRadius: 1, backgroundColor: colors.divider },
  tabs: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: { position: "absolute", left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: 16 },
}));
