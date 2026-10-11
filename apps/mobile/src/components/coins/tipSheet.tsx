import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Gift24Icon, SealCheck20Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { coinsService } from "@/services/money/coins.service";
import type { ID, TipTargetType } from "@/types";

import { BuyCoinsSheet } from "./buyCoinsSheet";
import { CoinBalanceChip } from "./coinBalanceChip";
import { COIN_BALANCE_QUERY_KEY, describeCoinError, formatCoinAmount, isNotEnoughCoinsError } from "./coinWallet.hook";
import { CoinAmountWithIcon } from "./coinAmount";

const PRESET_TIP_AMOUNTS = [10, 50, 100, 500] as const;

export interface TipTarget {
  readonly targetType: TipTargetType;
  readonly targetId: ID;
  readonly creatorName: string;
}

export function TipSheet({ target, onClose }: { target: TipTarget | null; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [selectedPresetCoins, setSelectedPresetCoins] = useState<number | null>(PRESET_TIP_AMOUNTS[1]);
  const [customCoins, setCustomCoins] = useState("");
  const [isBuyCoinsOpen, setIsBuyCoinsOpen] = useState(false);
  const pendingTipIdempotencyKey = useRef<string | null>(null);
  const coins = customCoins ? Number.parseInt(customCoins, 10) : (selectedPresetCoins ?? 0);

  const sendTip = useMutation({
    mutationFn: () => {
      pendingTipIdempotencyKey.current ??= generateIdempotencyKey();
      return coinsService.sendTip({ targetType: target!.targetType, targetId: target!.targetId, coins }, pendingTipIdempotencyKey.current);
    },
    onSuccess: () => {
      pendingTipIdempotencyKey.current = null;
      queryClient.invalidateQueries({ queryKey: COIN_BALANCE_QUERY_KEY });
    },
    onError: (error) => {
      if (isNotEnoughCoinsError(error)) setIsBuyCoinsOpen(true);
    },
  });

  const changeAmount = (change: () => void) => {
    change();
    pendingTipIdempotencyKey.current = null;
    sendTip.reset();
  };

  const closeAndReset = () => {
    changeAmount(() => setCustomCoins(""));
    onClose();
  };

  return (
    <>
      <BottomSheet visible={!!target && !isBuyCoinsOpen} onClose={closeAndReset} title={`Tip ${target?.creatorName ?? ""}`} floating scrollable>
        <View style={styles.body}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
            {sendTip.isSuccess ? <SealCheck20Icon size={22} color={colors.textMuted} /> : <Gift24Icon size={22} color={colors.textMuted} />}
          </View>
          <CoinBalanceChip onPress={() => setIsBuyCoinsOpen(true)} />
          {sendTip.isSuccess ? (
            <Text size={14} lineHeight={16.8} color={colors.success} accessibilityLiveRegion="polite">
              You tipped {formatCoinAmount(sendTip.data.coins)}. Thank you for supporting {target?.creatorName}!
            </Text>
          ) : (
            <>
              <View style={styles.presets}>
                {PRESET_TIP_AMOUNTS.map((amount) => {
                  const isSelected = !customCoins && selectedPresetCoins === amount;
                  return (
                    <Pressable
                      key={amount}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={formatCoinAmount(amount)}
                      onPress={() => changeAmount(() => {
                        setCustomCoins("");
                        setSelectedPresetCoins(amount);
                      })}
                      style={[styles.preset, isSelected ? styles.presetSelected : null]}
                    >
                      <CoinAmountWithIcon label={String(amount)} />
                    </Pressable>
                  );
                })}
              </View>
              <TextField
                label="Or enter an amount"
                value={customCoins}
                onChangeText={(text) => changeAmount(() => setCustomCoins(text.replace(/[^0-9]/g, "").slice(0, 6)))}
                keyboardType="number-pad"
              />
              {sendTip.isError ? (
                <Text size={12} lineHeight={16.8} color={colors.error}>
                  {describeCoinError(sendTip.error)}
                </Text>
              ) : null}
              <Button
                title={coins > 0 ? `Send ${formatCoinAmount(coins)}` : "Choose an amount"}
                disabled={!(coins > 0) || !target}
                loading={sendTip.isPending}
                onPress={() => sendTip.mutate()}
              />
            </>
          )}
        </View>
      </BottomSheet>
      <BuyCoinsSheet visible={isBuyCoinsOpen} onClose={() => setIsBuyCoinsOpen(false)} />
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingBottom: 4, gap: 12 },
  presets: { flexDirection: "row", gap: 8 },
  preset: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  presetSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
}));
