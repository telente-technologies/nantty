import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { FontWeight } from "@/constants/typography.constant";
import type { Money } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const splitSymbolFromNumber = (formatted: string) => {
  const match = formatted.match(/^([^\d\s-]*)\s?(.*)$/);
  return match && match[1] ? { symbol: match[1], number: match[2] ?? formatted } : { symbol: "", number: formatted };
};

export interface MoneyAmountProps {
  readonly money: Money;
  readonly symbolSize: number;
  readonly amountSize: number;
  readonly symbolWeight?: FontWeight;
  readonly amountWeight?: FontWeight;
  readonly showDecimals?: boolean;
  readonly color?: string;
}

export function MoneyAmount({ money, symbolSize, amountSize, symbolWeight = 600, amountWeight = 600, showDecimals = true, color }: MoneyAmountProps) {
  const formatted = formatMoneyForDisplay(money, { showDecimals });
  const { symbol, number } = splitSymbolFromNumber(formatted);
  return (
    <View style={styles.row} accessible accessibilityLabel={formatted}>
      {symbol ? (
        <Text size={symbolSize} weight={symbolWeight} lineHeight={symbolSize * 1.4} color={color}>
          {symbol}
        </Text>
      ) : null}
      <Text size={amountSize} weight={amountWeight} lineHeight={amountSize * 1.2} color={color}>
        {number}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "baseline" } });
