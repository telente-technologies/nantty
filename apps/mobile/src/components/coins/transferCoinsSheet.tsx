import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { SealCheck20Icon, Wallet24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { coinsService } from "@/services/money/coins.service";
import type { UserSummary } from "@/types";

import { CoinBalanceChip } from "./coinBalanceChip";
import { COIN_BALANCE_QUERY_KEY, describeCoinError, formatCoinAmount, useCoinBalance } from "./coinWallet.hook";

export interface TransferCoinsSheetProps {
  readonly visible: boolean;
  readonly recipient: UserSummary | null;
  readonly onClose: () => void;
}

export function TransferCoinsSheet({ visible, recipient, onClose }: TransferCoinsSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [typedCoins, setTypedCoins] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const pendingTransferIdempotencyKey = useRef<string | null>(null);
  const balance = useCoinBalance(visible);
  const coins = Number.parseInt(typedCoins, 10);
  const hasValidAmount = Number.isInteger(coins) && coins > 0 && coins <= (balance.data?.coins ?? 0);
  const quote = useQuery({
    queryKey: ["coin-transfer-quote", coins],
    queryFn: () => coinsService.fetchCoinTransferQuote(coins),
    enabled: visible && hasValidAmount,
    staleTime: 60_000,
  });

  const transfer = useMutation({
    mutationFn: () => {
      pendingTransferIdempotencyKey.current ??= generateIdempotencyKey();
      return coinsService.transferCoinsToUser(recipient!.id, coins, pendingTransferIdempotencyKey.current);
    },
    onSuccess: () => {
      pendingTransferIdempotencyKey.current = null;
      queryClient.invalidateQueries({ queryKey: COIN_BALANCE_QUERY_KEY });
    },
  });

  const closeAndReset = () => {
    setTypedCoins("");
    setIsConfirming(false);
    pendingTransferIdempotencyKey.current = null;
    transfer.reset();
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={closeAndReset} title={`Send coins to ${recipient?.name ?? ""}`} floating>
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          {transfer.isSuccess ? <SealCheck20Icon size={22} color={colors.textMuted} /> : <Wallet24Icon size={22} color={colors.textMuted} />}
        </View>
        <CoinBalanceChip />
        {transfer.isSuccess ? (
          <Text size={14} lineHeight={16.8} color={colors.success} accessibilityLiveRegion="polite">
            Sent. {recipient?.name} received {formatCoinAmount(transfer.data.netCoins)}.
          </Text>
        ) : (
          <>
            <TextField
              label="Coins to send"
              value={typedCoins}
              onChangeText={(text) => {
                setTypedCoins(text.replace(/[^0-9]/g, "").slice(0, 7));
                setIsConfirming(false);
              }}
              keyboardType="number-pad"
            />
            {hasValidAmount && quote.data ? (
              <View style={styles.quote} accessibilityLabel={`Platform fee ${quote.data.feeCoins} coins. ${recipient?.name} receives ${quote.data.netCoins} coins`}>
                <Text size={13} lineHeight={16.9} color={colors.textMuted}>
                  Platform fee ({quote.data.feePercent}%): {formatCoinAmount(quote.data.feeCoins)}
                </Text>
                <Text size={14} weight={600} lineHeight={16.8}>
                  {recipient?.name} receives {formatCoinAmount(quote.data.netCoins)}
                </Text>
              </View>
            ) : null}
            {typedCoins && !hasValidAmount ? (
              <Text size={12} lineHeight={16.8} color={colors.error}>
                Enter an amount up to your balance.
              </Text>
            ) : null}
            {transfer.isError ? (
              <Text size={12} lineHeight={16.8} color={colors.error}>
                {describeCoinError(transfer.error)}
              </Text>
            ) : null}
            <Button
              title={isConfirming ? `Confirm: send ${formatCoinAmount(coins)}` : "Review transfer"}
              disabled={!hasValidAmount || !quote.data || !recipient}
              loading={transfer.isPending}
              onPress={() => (isConfirming ? transfer.mutate() : setIsConfirming(true))}
            />
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  quote: { gap: 4, padding: 12, borderRadius: 8, backgroundColor: colors.background },
}));
