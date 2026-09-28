import { Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors } from "@/constants/colors";

import { Text } from "./text";

export interface ChipProps {
  readonly label: string;
  readonly selected?: boolean;
  readonly onPress?: () => void;
  readonly kind?: "topic" | "filter";
  readonly dropdown?: boolean;
}

export function Chip({ label, selected = false, onPress, kind = "topic", dropdown = false }: ChipProps) {
  const look = kind === "topic" ? topic : filter;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[look.box, { backgroundColor: selected ? look.selectedBg : look.bg }]}
    >
      <Text size={13} weight={500} lineHeight={16.9} color={selected ? look.selectedText : colors.textMuted}>
        {label}
      </Text>
      {dropdown ? (
        <Svg width={12} height={12} viewBox="0 0 12 12">
          <Path d="M1.8 3.2h8.4a.6.6 0 0 1 .47.98l-4.2 5.1a.6.6 0 0 1-.93 0l-4.2-5.1a.6.6 0 0 1 .46-.98Z" fill={colors.black} />
        </Svg>
      ) : null}
    </Pressable>
  );
}

const topic = {
  box: { height: 33, paddingHorizontal: 8, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 10 } as const,
  bg: colors.skeleton,
  selectedBg: colors.primary,
  selectedText: colors.white,
};

const filter = {
  box: { height: 25, paddingHorizontal: 4, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 8 } as const,
  bg: colors.white,
  selectedBg: colors.chip,
  selectedText: colors.black,
};

export const chipStyles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: 12 } });
