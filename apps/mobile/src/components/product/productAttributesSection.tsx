import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { ProductAttribute } from "@/types/models.type";

interface ProductAttributesSectionProps {
  readonly attributes: readonly ProductAttribute[];
}

export function ProductAttributesSection({ attributes }: ProductAttributesSectionProps) {
  const { colors } = useTheme();
  const visibleAttributes = attributes.filter(({ name, value }) => name.trim() && value.trim());
  if (visibleAttributes.length === 0) return null;

  return (
    <View style={[styles.section, { borderTopColor: colors.divider }]}>
      <Text size={14} weight={600} accessibilityRole="header">Product details</Text>
      {visibleAttributes.map(({ name, value }, index) => (
        <View key={`${name}-${index}`} style={styles.row}>
          <Text size={12} color={colors.textSubtle}>{name}</Text>
          <Text size={13} color={colors.textMuted} style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  value: { flex: 1, textAlign: "right" },
});
