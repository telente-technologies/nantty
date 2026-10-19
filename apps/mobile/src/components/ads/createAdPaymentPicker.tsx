import { StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { BoostPaymentMethod } from "@/types/boost.type";
import type { BoostPaymentChoice } from "@/utils/adsHub.util";

export interface CreateAdPaymentPickerProps {
  readonly choices: readonly BoostPaymentChoice[];
  readonly selected: BoostPaymentMethod | null;
  readonly onSelect: (method: BoostPaymentMethod) => void;
}

export function CreateAdPaymentPicker({ choices, selected, onSelect }: CreateAdPaymentPickerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (choices.length === 0) return <Text size={13} lineHeight={16.9} color={colors.error}>Ads can't be paid for right now. Please try again later.</Text>;
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Pay with">
      {choices.map((choice) =>
        choice.selectable ? (
          <SelectableRow key={choice.method} selected={selected === choice.method} onPress={() => onSelect(choice.method)} accessibilityLabel={choice.note ? `${choice.label}. ${choice.note}` : choice.label}>
            <Text size={14} weight={500} lineHeight={16.8}>{choice.label}</Text>
            {choice.note ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>{choice.note}</Text> : null}
          </SelectableRow>
        ) : (
          <View key={choice.method} style={styles.unavailable} accessible accessibilityRole="text" accessibilityState={{ disabled: true }} accessibilityLabel={`${choice.label}, unavailable. ${choice.note ?? ""}`}>
            <Text size={14} weight={500} lineHeight={16.8} color={colors.textMuted}>{choice.label}</Text>
            {choice.note ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>{choice.note}</Text> : null}
          </View>
        ),
      )}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  group: { gap: 8 },
  unavailable: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, gap: 4, opacity: 0.7 },
}));
