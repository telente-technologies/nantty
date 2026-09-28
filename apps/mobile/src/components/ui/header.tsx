import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { ArrowLeft24Icon } from "@/components/icons";

import { Text } from "./text";

export interface HeaderProps {
  readonly title?: string;
  readonly titleSize?: number;
  readonly onBack?: (() => void) | null;
  readonly right?: ReactNode;
  readonly center?: ReactNode;
  readonly paddingHorizontal?: number;
  readonly color?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function Header({ title, titleSize = 18, onBack, right, center, paddingHorizontal = 16, color, style }: HeaderProps) {
  const navigation = useNavigation();
  const back = onBack === null ? null : onBack ?? (navigation.canGoBack() ? () => navigation.goBack() : null);
  return (
    <View style={[styles.bar, { paddingHorizontal }, style]}>
      <View style={styles.left}>
        {back ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={back}>
            <ArrowLeft24Icon color={color} />
          </Pressable>
        ) : null}
        {title ? (
          <Text size={titleSize} weight={500} lineHeight={titleSize * 1.2} color={color} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
      </View>
      {center ? <View style={styles.center} pointerEvents="box-none">{center}</View> : null}
      <View style={styles.right}>{right}</View>
    </View>
  );
}

export function HeaderAction({ label, onPress, children }: { label: string; onPress?: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={onPress}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", gap: 18 },
  center: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  right: { flexDirection: "row", alignItems: "center", gap: 16 },
});
