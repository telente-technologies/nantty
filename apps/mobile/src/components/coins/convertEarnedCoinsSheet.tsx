import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Repeat24Icon, SealCheck20Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { coinsService } from "@/services/money/coins.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { COIN_BALANCE_QUERY_KEY, describeCoinError, formatCoinAmount, useCoinBalance } from "./coinWallet.hook";

export interface ConvertEarnedCoinsSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function ConvertEarnedCoinsSheet({ visible, onClose }: ConvertEarnedCoinsSheetProps) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [typedCoins, setTypedCoins] = useState("");
  const pendingIdempotencyKey = useRef<string | null>(null);
  const balance = useCoinBalance(visible);
  const earned = balance.data?.earnedCoins ?? 0;
  const coins = Number.parseInt(typedCoins, 10);
  const hasValidAmount = Number.isInteger(coins) && coins > 0 && coins <= earned;

  const convert = useMutation({
    mutationFn: () => {
      pendingIdempotencyKey.current ??= generateIdempotencyKey();
      return coinsService.convertEarnedCoins(coins, pendingIdempotencyKey.current);
    },
    onSuccess: () => {
      pendingIdempotencyKey.current = null;
      queryClient.invalidateQueries({ queryKey: COIN_BALANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["coin-activity"] });
    },
  });

  const closeAndReset = () => {
    setTypedCoins("");
    pendingIdempotencyKey.current = null;
    convert.reset();
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={closeAndReset} title="Convert earned coins" floating>
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          {convert.isSuccess ? <SealCheck20Icon size={22} color={colors.textMuted} /> : <Repeat24Icon size={22} color={colors.textMuted} />}
        </View>
        {convert.isSuccess ? (
          <View style={styles.receipt} accessibilityLiveRegion="polite">
            <Text size={16} weight={600} lineHeight={19.2} color={colors.success}>Converted</Text>
            <Text size={14} lineHeight={16.8}>
              You received {formatMoneyForDisplay(convert.data.cash)} for {formatCoinAmount(convert.data.coins)}.
            </Text>
            <Text size={13} lineHeight={16.9} color={colors.textMuted}>
              {formatCoinAmount(convert.data.earnedCoinsRemaining)} earned coins remaining.
            </Text>
            <Button title="Done" onPress={closeAndReset} />
          </View>
        ) : (
          <>
            <Text size={13} lineHeight={16.9} color={colors.textMuted}>{formatCoinAmount(earned)} earned coins available.</Text>
            <TextField
              label="Earned coins to convert"
              value={typedCoins}
              onChangeText={(text) => {
                pendingIdempotencyKey.current = null;
                setTypedCoins(text.replace(/[^0-9]/g, "").slice(0, 7));
              }}
              keyboardType="number-pad"
            />
            {typedCoins && !hasValidAmount ? (
              <Text size={12} lineHeight={16.8} color={colors.error}>Enter an amount up to your earned coins.</Text>
            ) : null}
            {convert.isError ? (
              <Text size={12} lineHeight={16.8} color={colors.error}>{describeCoinError(convert.error)}</Text>
            ) : null}
            <Button
              title={hasValidAmount ? `Convert ${formatCoinAmount(coins)}` : "Convert"}
              disabled={!hasValidAmount}
              loading={convert.isPending}
              onPress={() => convert.mutate()}
            />
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  receipt: { gap: 8 },
});
