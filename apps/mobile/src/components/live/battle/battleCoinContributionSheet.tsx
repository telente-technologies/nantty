import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { BuyCoinsSheet } from "@/components/coins/buyCoinsSheet";
import { COIN_BALANCE_QUERY_KEY, formatCoinAmount, isNotEnoughCoinsError } from "@/components/coins/coinWallet.hook";
import { CoinBalanceChip } from "@/components/coins/coinBalanceChip";
import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { ApiError, generateIdempotencyKey } from "@/services/core/apiClient.service";
import { liveGuestsService } from "@/services/live/liveGuests.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { LiveBattle, LiveStage, LiveStageStreamer } from "@/types/liveStage.type";

export interface BattleCoinContributionSheetProps {
  readonly battle: LiveBattle | null;
  readonly recipient: LiveStageStreamer | null;
  readonly onStageUpdated: (stage: LiveStage) => void;
  readonly onClose: () => void;
}

export function BattleCoinContributionSheet({ battle, recipient, onStageUpdated, onClose }: BattleCoinContributionSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [showBuyCoins, setShowBuyCoins] = useState(false);
  const pendingContribution = useRef<{ battleId: string; recipientId: string; coins: number; key: string } | null>(null);
  const coins = Number(amount);
  const isValidAmount = Number.isSafeInteger(coins) && coins > 0;
  const battleId = battle?.state === "active" ? battle.id : null;

  const contribution = useMutation({
    mutationFn: () => {
      if (!battleId || !recipient || !isValidAmount) throw new Error("Enter a whole number of coins to contribute.");
      const recipientId = recipient.user.id;
      const pending = pendingContribution.current;
      const key = pending?.battleId === battleId && pending.recipientId === recipientId && pending.coins === coins
        ? pending.key
        : generateIdempotencyKey();
      pendingContribution.current = { battleId, recipientId, coins, key };
      return liveGuestsService.contributeBattleCoins(battleId, { recipientUserId: recipientId, coins }, key);
    },
    onSuccess: (stage) => {
      pendingContribution.current = null;
      onStageUpdated(stage);
      void queryClient.invalidateQueries({ queryKey: COIN_BALANCE_QUERY_KEY });
      onClose();
    },
    onError: (error) => {
      if (isNotEnoughCoinsError(error)) setShowBuyCoins(true);
    },
  });

  const errorMessage = contribution.error instanceof ApiError
    ? contribution.error.message
    : contribution.error instanceof Error
      ? contribution.error.message
      : contribution.isError
        ? "We couldn't send your contribution. Check your connection and try again."
        : null;

  return (
    <>
      <BottomSheet
        visible={!!recipient && !!battleId && !showBuyCoins}
        onClose={onClose}
        title="Contribute coins"
        subtitle={recipient ? `Support ${recipient.user.name} in this battle` : undefined}
        floating
      >
        <View style={styles.body}>
          <View style={styles.recipientRow}>
            <Avatar uri={recipient?.user.avatarUrl} size={36} />
            <Text size={14} lineHeight={19} color={colors.textMuted} style={styles.flex}>
              Your coin contribution adds to this participant&apos;s battle score.
            </Text>
            <CoinBalanceChip />
          </View>
          <TextInput
            value={amount}
            onChangeText={(value) => {
              setAmount(value.replace(/\D/g, ""));
              pendingContribution.current = null;
              contribution.reset();
            }}
            keyboardType="number-pad"
            placeholder="Enter coin amount"
            placeholderTextColor={colors.textSubtle}
            selectionColor={colors.primary}
            accessibilityLabel="Coin contribution amount"
            accessibilityHint="Enter a whole number of coins to add to the participant's battle score"
            style={styles.amountInput}
          />
          {isValidAmount ? (
            <Text size={12} lineHeight={16} color={colors.textMuted} accessibilityLiveRegion="polite">
              Contribution: {formatCoinAmount(coins)}
            </Text>
          ) : null}
          {errorMessage ? (
            <Text size={12} lineHeight={16} color={colors.error} accessibilityLiveRegion="polite">
              {errorMessage}
            </Text>
          ) : null}
          <Button
            title={isValidAmount ? `Contribute ${formatCoinAmount(coins)}` : "Enter coin amount"}
            disabled={!isValidAmount || !battleId || !recipient}
            loading={contribution.isPending}
            onPress={() => contribution.mutate()}
          />
        </View>
      </BottomSheet>
      <BuyCoinsSheet visible={!!recipient && showBuyCoins} onClose={() => setShowBuyCoins(false)} />
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 20, gap: 14 },
  flex: { flex: 1 },
  recipientRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  amountInput: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    fontFamily: fontFamily[400],
    fontSize: 16,
    letterSpacing: calculateDefaultLetterSpacing(16),
    color: colors.text,
  },
}));
