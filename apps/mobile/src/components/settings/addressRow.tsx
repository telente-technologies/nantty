import { Pressable, StyleSheet, View } from "react-native";

import { CaretRight24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { Address } from "@/types";

export function AddressRow({ address, onPress }: { address: Address; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${address.fullName}, ${address.line1}, ${address.city}, ${address.state}${address.isDefault ? ", default address" : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.details}>
        <View style={styles.nameRow}>
          <Text size={14} weight={500} lineHeight={16.8}>
            {address.fullName}
          </Text>
          {address.isDefault ? (
            <View style={styles.defaultPill}>
              <Text size={11} weight={500} lineHeight={15} color={colors.primary}>
                Default
              </Text>
            </View>
          ) : null}
        </View>
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>
          {address.line1}, {address.city}, {address.state}
        </Text>
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>
          {address.phone}
        </Text>
      </View>
      <CaretRight24Icon />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.white, paddingVertical: 16, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  details: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  defaultPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: colors.primaryTint },
  pressed: { opacity: 0.7 },
});
