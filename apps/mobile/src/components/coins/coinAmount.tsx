import { StyleSheet, View } from "react-native";

import { Coin24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import type { FontWeight } from "@/constants/typography.constant";

export interface CoinAmountProps {
  readonly label: string;
  readonly size?: number;
  readonly weight?: FontWeight;
  readonly color?: string;
}

export function CoinAmountWithIcon({ label, size = 14, weight = 600, color }: CoinAmountProps) {
  return (
    <View style={styles.row}>
      <Coin24Icon size={size + 2} color={color} />
      <Text size={size} weight={weight} lineHeight={size * 1.2} color={color}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 4 } });
