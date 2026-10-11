import { StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { RocketLaunch24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { FreeBoostAllowance } from "@/types/boost.type";
import type { Money } from "@/types";
import { NATIVE_BOOST_PAYMENT_NOTE, formatFreeBoostReset, freeBoostAvailableLabel, type NativeBoostPaymentMethod } from "@/utils/boostPayment.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export interface BoostPaymentPickerProps {
  readonly paymentMethod: NativeBoostPaymentMethod;
  readonly cardAllowed: boolean;
  readonly freeBoost: FreeBoostAllowance | null;
  readonly freeBoostFits: boolean;
  readonly usedFreeBoost: FreeBoostAllowance | null;
  readonly totalCost: Money | null;
  readonly onSelectCard: () => void;
  readonly onSelectFree: () => void;
}

export function BoostPaymentPicker({ paymentMethod, cardAllowed, freeBoost, freeBoostFits, usedFreeBoost, totalCost, onSelectCard, onSelectFree }: BoostPaymentPickerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const nextFreeBoost = formatFreeBoostReset(usedFreeBoost?.resetsAt);
  return (
    <View style={styles.group}>
      {freeBoost ? (
        <SelectableRow selected={paymentMethod === "free"} onPress={onSelectFree} accessibilityLabel={`${freeBoostAvailableLabel(freeBoost)}. Covers up to ${formatMoneyForDisplay(freeBoost.maxTotal, { showDecimals: false })}`}>
          <View style={styles.titleRow}>
            <RocketLaunch24Icon size={16} color={colors.primary} />
            <Text size={14} weight={500} lineHeight={16.8}>{freeBoostAvailableLabel(freeBoost)}</Text>
          </View>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            {freeBoostFits
              ? `Premium perk. Covers a boost up to ${formatMoneyForDisplay(freeBoost.maxTotal, { showDecimals: false })} in total.`
              : `Covers up to ${formatMoneyForDisplay(freeBoost.maxTotal, { showDecimals: false })} in total. Pick a smaller package to use it.`}
          </Text>
        </SelectableRow>
      ) : usedFreeBoost ? (
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>
          {nextFreeBoost ? `You've used this month's free boost. Your next one arrives on ${nextFreeBoost}.` : "You've used this month's free boost."}
        </Text>
      ) : null}
      {cardAllowed ? (
        <SelectableRow selected={paymentMethod === "card"} onPress={onSelectCard} accessibilityLabel={`Card or bank transfer${totalCost ? `, ${formatMoneyForDisplay(totalCost)}` : ""}`}>
          <Text size={14} weight={500} lineHeight={16.8}>Card or bank transfer</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>{totalCost ? `${formatMoneyForDisplay(totalCost)} · secure payment window` : "Secure payment window"}</Text>
        </SelectableRow>
      ) : freeBoost ? null : (
        <Text size={12} lineHeight={16.8} color={colors.error}>Boosts can't be paid for in the app right now. Please try again later.</Text>
      )}
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>{NATIVE_BOOST_PAYMENT_NOTE}</Text>
    </View>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  group: { gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
}));
