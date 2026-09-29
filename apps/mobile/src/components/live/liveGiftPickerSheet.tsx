import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Minus16Icon, Plus16Icon } from "@/components/icons";
import { BuyCoinsSheet } from "@/components/coins/buyCoinsSheet";
import { CoinBalanceChip } from "@/components/coins/coinBalanceChip";
import { formatCoinAmount } from "@/components/coins/coinWallet.hook";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { LiveGift } from "@/types";
import { CoinAmountWithIcon } from "@/components/coins/coinAmount";

const MAXIMUM_GIFTS_PER_SEND = 99;

export interface LiveGiftPickerSheetProps {
  readonly visible: boolean;
  readonly gifts: readonly LiveGift[];
  readonly isLoadingGifts: boolean;
  readonly isSendingGift: boolean;
  readonly errorMessage: string | null;
  readonly hasNotEnoughCoins: boolean;
  readonly onChangeSelection: () => void;
  readonly onSendGift: (gift: LiveGift, quantity: number) => void;
  readonly onClose: () => void;
}

export function LiveGiftPickerSheet(props: LiveGiftPickerSheetProps) {
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const selectedGift = props.gifts.find((gift) => gift.id === selectedGiftId) ?? null;
  const [isBuyCoinsOpen, setIsBuyCoinsOpen] = useState(false);

  useEffect(() => {
    if (props.hasNotEnoughCoins) setIsBuyCoinsOpen(true);
  }, [props.hasNotEnoughCoins]);

  const selectGift = (giftId: string) => {
    setSelectedGiftId(giftId);
    props.onChangeSelection();
  };
  const changeQuantityBy = (change: number) => {
    setQuantity((current) => Math.min(MAXIMUM_GIFTS_PER_SEND, Math.max(1, current + change)));
    props.onChangeSelection();
  };

  return (
    <>
      <BottomSheet visible={props.visible && !isBuyCoinsOpen} onClose={props.onClose} title="Send a gift" floating>
        <View style={styles.body}>
          <CoinBalanceChip onPress={() => setIsBuyCoinsOpen(true)} />
          {props.isLoadingGifts ? <ActivityIndicator color={colors.primary} /> : null}
          <View style={styles.grid}>
            {props.gifts.map((gift) => {
              const isSelected = gift.id === selectedGiftId;
              return (
                <Pressable
                  key={gift.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${gift.name}, ${formatCoinAmount(gift.priceCoins)}`}
                  onPress={() => selectGift(gift.id)}
                  style={[styles.giftTile, isSelected ? styles.giftTileSelected : null]}
                >
                  <Text size={28} lineHeight={34}>
                    {gift.emoji}
                  </Text>
                  <Text size={12} weight={500} lineHeight={14.4} numberOfLines={1}>
                    {gift.name}
                  </Text>
                  <CoinAmountWithIcon size={11} weight={400} color={colors.textMuted} label={gift.priceCoins.toLocaleString("en-US")} />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.quantityRow}>
            <Text size={14} weight={500} lineHeight={16.8}>
              Quantity
            </Text>
            <View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel="Fewer gifts" hitSlop={10} onPress={() => changeQuantityBy(-1)}>
                <Minus16Icon />
              </Pressable>
              <Text size={14} weight={600} lineHeight={16.8} accessibilityLabel={`${quantity} gifts`}>
                {quantity}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="More gifts" hitSlop={10} onPress={() => changeQuantityBy(1)}>
                <Plus16Icon />
              </Pressable>
            </View>
          </View>
          {props.errorMessage ? (
            <Text size={12} lineHeight={16.8} color={colors.error} accessibilityLiveRegion="polite">
              {props.errorMessage}
            </Text>
          ) : null}
          <Button
            title={selectedGift ? `Send for ${formatCoinAmount(selectedGift.priceCoins * quantity)}` : "Choose a gift"}
            disabled={!selectedGift}
            loading={props.isSendingGift}
            onPress={() => selectedGift && props.onSendGift(selectedGift, quantity)}
          />
        </View>
      </BottomSheet>
      <BuyCoinsSheet
        visible={props.visible && isBuyCoinsOpen}
        onClose={() => {
          setIsBuyCoinsOpen(false);
          props.onChangeSelection();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 20, gap: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  giftTile: {
    width: "31%",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    gap: 4,
  },
  giftTileSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  quantityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16 },
});
