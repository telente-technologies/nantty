import { Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

import { useCoinBalance } from "./coinWallet.hook";
import { CoinAmountWithIcon } from "./coinAmount";

export function CoinBalanceChip({ onPress }: { onPress?: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const balance = useCoinBalance();
  const coins = balance.data?.coins;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={coins === undefined ? "Coin balance loading. Buy coins" : `${coins} coins. Buy coins`}
      disabled={!onPress}
      onPress={onPress}
      style={styles.chip}
    >
      <CoinAmountWithIcon size={12} label={coins === undefined ? "…" : coins.toLocaleString("en-US")} />
      {onPress ? (
        <Text size={12} weight={600} lineHeight={14.4} color={colors.primary}>
          + Buy
        </Text>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
}));
