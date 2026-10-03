import { Pressable, StyleSheet, View } from "react-native";

import { CaretRight24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Address } from "@/types";

export const formatAddressLocation = (address: Address) =>
  [address.line1, address.city, address.lga, address.state, address.country].filter(Boolean).join(", ");

export function AddressRow({ address, onPress }: { address: Address; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${address.fullName}, ${formatAddressLocation(address)}${address.isDefault ? ", default address" : ""}`}
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
          {formatAddressLocation(address)}
        </Text>
        <Text size={13} lineHeight={16.9} color={colors.textMuted}>
          {address.phone}
        </Text>
      </View>
      <CaretRight24Icon />
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { backgroundColor: colors.surface, paddingVertical: 16, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  details: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  defaultPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: colors.primaryTint },
  pressed: { opacity: 0.7 },
}));
