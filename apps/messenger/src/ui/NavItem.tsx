import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Icon } from "phosphor-react-native";

import { useMessengerColors } from "./useMessengerColors";

export function NavItem({
  label,
  Icon: Glyph,
  selected,
  onPress,
  vertical = false,
}: {
  readonly label: string;
  readonly Icon: Icon;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly vertical?: boolean;
}) {
  const colors = useMessengerColors();
  const ink = selected ? colors.brand : colors.muted;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [vertical ? styles.railItem : styles.tabItem, pressed && styles.pressed]}
    >
      <View style={[styles.iconBox, vertical && styles.railIconBox, selected && { backgroundColor: colors.brandTint }]}>
        <Glyph size={22} color={ink} weight={selected ? "fill" : "regular"} />
      </View>
      <Text style={[styles.label, { color: ink }, vertical && styles.railLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabItem: { minWidth: 76, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 5, paddingHorizontal: 8 },
  railItem: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 10, borderRadius: 12 },
  iconBox: { width: 31, height: 26, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  railIconBox: { width: 28, height: 28 },
  label: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
  railLabel: { fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.7 },
});
