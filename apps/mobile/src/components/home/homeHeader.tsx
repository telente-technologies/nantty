import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";

import { Bell24Icon, Headset24Icon, MagnifyingGlass24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainStackParamList } from "@/navigation/navigation.types";

import { CartHeaderButtonShownOnlyWhenCartHasItems } from "./cartHeaderButton";

export type HomeSection = "feed" | "mart";

export interface HomeHeaderProps {
  readonly activeSection: HomeSection;
  readonly onChangeSection: (section: HomeSection) => void;
  readonly pagerOffset?: SharedValue<number>;
  readonly pageWidth?: number;
  readonly onPressSearch: () => void;
  readonly onPressNotifications: () => void;
}

function SectionTabLabel({ label, sectionIndex, isActive, pagerOffset, pageWidth }: { readonly label: string; readonly sectionIndex: number; readonly isActive: boolean; readonly pagerOffset?: SharedValue<number>; readonly pageWidth?: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const highlightStyle = useAnimatedStyle(() => {
    if (!pagerOffset || !pageWidth) return { opacity: isActive ? 1 : 0 };
    const position = -pagerOffset.value / pageWidth;
    return { opacity: 1 - Math.min(1, Math.abs(position - sectionIndex)) };
  });
  const weight = isActive ? 600 : 500;
  return (
    <View>
      <Text size={18} weight={weight} lineHeight={21.6} letterSpacing={-0.36} color={colors.textSubtle}>
        {label}
      </Text>
      <Animated.View style={[styles.labelHighlight, highlightStyle]} pointerEvents="none">
        <Text size={18} weight={weight} lineHeight={21.6} letterSpacing={-0.36} color={colors.primary}>
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

export function HomeHeader({ activeSection, onChangeSection, pagerOffset, pageWidth, onPressSearch, onPressNotifications }: HomeHeaderProps) {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { colors } = useTheme();
  const styles = useStyles();
  const sectionTab = (section: HomeSection, label: string, sectionIndex: number) => {
    const active = activeSection === section;
    return (
      <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={() => onChangeSection(section)} hitSlop={8}>
        <SectionTabLabel label={label} sectionIndex={sectionIndex} isActive={active} pagerOffset={pagerOffset} pageWidth={pageWidth} />
      </Pressable>
    );
  };

  return (
    <View style={styles.bar}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {sectionTab("feed", "Feed", 0)}
        {sectionTab("mart", "Mart", 1)}
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Search" hitSlop={10} onPress={onPressSearch}>
          <MagnifyingGlass24Icon />
        </Pressable>
        <CartHeaderButtonShownOnlyWhenCartHasItems />
        <Pressable accessibilityRole="button" accessibilityLabel="Explore Nantty Spaces" onPress={() => navigation.navigate("Spaces")} hitSlop={10}>
          <Headset24Icon size={24} color={colors.text} />
        </Pressable>
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
  labelHighlight: { position: "absolute", left: 0, top: 0 },
  actions: { flexDirection: "row", alignItems: "center", gap: 16 },
}));
