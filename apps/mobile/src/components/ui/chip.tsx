import { Pressable, StyleSheet } from "react-native";

import { CaretDownIcon } from "@/components/icons/phosphorGlyphs";
import { makeThemedStyles, useTheme } from "@/theme";

import { Text } from "./text";

export interface ChipProps {
  readonly label: string;
  readonly selected?: boolean;
  readonly onPress?: () => void;
  readonly kind?: "topic" | "filter";
  readonly dropdown?: boolean;
}

export function Chip({ label, selected = false, onPress, kind = "topic", dropdown = false }: ChipProps) {
  const { colors } = useTheme();
  const looks = useChipLooks();
  const look = kind === "topic" ? looks.topic : looks.filter;
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
        <CaretDownIcon size={12} weight="fill" color={colors.text} />
      ) : null}
    </Pressable>
  );
}

const useChipLooks = makeThemedStyles((colors) => ({
  topic: {
    box: { height: 33, paddingHorizontal: 8, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 10 } as const,
    bg: colors.skeleton,
    selectedBg: colors.primarySolid,
    selectedText: colors.onPrimary,
  },
  filter: {
    box: { height: 25, paddingHorizontal: 4, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 8 } as const,
    bg: colors.surface,
    selectedBg: colors.chip,
    selectedText: colors.text,
  },
}));

export const chipStyles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: 12 } });
