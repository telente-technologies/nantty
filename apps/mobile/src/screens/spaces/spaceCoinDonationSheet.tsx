import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { CoinBalanceChip } from "@/components/coins/coinBalanceChip";
import { BuyCoinsSheet } from "@/components/coins/buyCoinsSheet";
import { COIN_BALANCE_QUERY_KEY, describeCoinError, isNotEnoughCoinsError, useCoinBalance } from "@/components/coins/coinWallet.hook";
import { CoinAmountWithIcon } from "@/components/coins/coinAmount";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { spacesService, type SpacePerson } from "@/services/spaces.service";
import { showToast } from "@/store/toast.store";
import { makeThemedStyles, useTheme } from "@/theme";

interface SpaceCoinDonationSheetProps {
  readonly spaceId: string;
  readonly host: SpacePerson;
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function SpaceCoinDonationSheet({ spaceId, host, visible, onClose }: SpaceCoinDonationSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const client = useQueryClient();
  useCoinBalance(visible);
  const [coinsText, setCoinsText] = useState("");
  const [buyCoinsOpen, setBuyCoinsOpen] = useState(false);
  const pendingDonation = useRef<{ coins: number; key: string } | null>(null);
  const coins = Number(coinsText);
  const validAmount = Number.isSafeInteger(coins) && coins > 0;
  const sendDonation = useMutation({
    mutationFn: () => {
      if (!validAmount) throw new Error("Enter a whole number of coins to donate.");
      if (pendingDonation.current?.coins !== coins) pendingDonation.current = { coins, key: generateIdempotencyKey() };
      return spacesService.sendCoinDonation(spaceId, coins, pendingDonation.current.key);
    },
    onSuccess: async (receipt) => {
      pendingDonation.current = null;
      await client.invalidateQueries({ queryKey: COIN_BALANCE_QUERY_KEY });
      showToast(`${receipt.totalCoins.toLocaleString()} coins sent to ${host.name}.`, { tone: "success" });
      setCoinsText("");
      onClose();
    },
    onError: (error) => {
      if (isNotEnoughCoinsError(error)) {
        pendingDonation.current = null;
        setBuyCoinsOpen(true);
      }
    },
  });

  return (
    <>
      <BottomSheet visible={visible && !buyCoinsOpen} onClose={onClose} title={`Support ${host.name}`} subtitle="Send coins directly to the host. No virtual gifts or animations." floating scrollable>
        <View style={styles.content}>
          <CoinBalanceChip onPress={() => setBuyCoinsOpen(true)} />
          <Text weight={600}>Coin amount</Text>
          <TextInput
            accessibilityLabel="Coin donation amount"
            accessibilityHint="Enter a whole number of coins. The server applies the current donation limits."
            value={coinsText}
            onChangeText={(value) => {
              setCoinsText(value.replace(/[^0-9]/g, ""));
              sendDonation.reset();
              pendingDonation.current = null;
            }}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={12}
            placeholder="Enter coins"
            placeholderTextColor={colors.textSubtle}
            style={styles.amountInput}
          />
          {validAmount ? <CoinAmountWithIcon label={coins.toLocaleString()} /> : null}
          {sendDonation.isError ? <Text accessibilityRole="alert" color={colors.error}>{describeCoinError(sendDonation.error)}</Text> : null}
          <Button
            title={validAmount ? `Donate ${coins.toLocaleString()} coins` : "Enter a coin amount"}
            disabled={!validAmount || sendDonation.isPending}
            loading={sendDonation.isPending}
            onPress={() => sendDonation.mutate()}
          />
        </View>
      </BottomSheet>
      <BuyCoinsSheet visible={visible && buyCoinsOpen} onClose={() => setBuyCoinsOpen(false)} />
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 18, gap: 14 },
  amountInput: { minHeight: 52, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.surface },
}));
