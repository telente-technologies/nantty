import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { BuyCoinsSheet } from "@/components/coins/buyCoinsSheet";
import { CoinBalanceChip } from "@/components/coins/coinBalanceChip";
import { formatCoinAmount } from "@/components/coins/coinWallet.hook";
import { Avatar } from "@/components/ui/avatar";
import { LiveGiftArtwork } from "@/components/live/gifts/liveGiftArtwork";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { BrandLoader } from "@/components/ui/brandLoader";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { LiveBattle, LiveStage, LiveStageStreamer } from "@/types/liveStage.type";
import { makeThemedStyles, useTheme } from "@/theme";

import { useSendBattleGiftToStreamer } from "./sendBattleGift.adapter";
import { Coin24Icon } from "@/components/icons";
import { IconRow } from "@/components/ui/iconRow";

export interface BattleGiftPickerSheetProps {
  readonly liveId: string;
  readonly recipient: LiveStageStreamer | null;
  readonly battle: LiveBattle | null;
  readonly signedInUserId: string | null;
  readonly hostName: string;
  readonly onStageUpdated: (stage: LiveStage) => void;
  readonly onClose: () => void;
}

export function BattleGiftPickerSheet(props: BattleGiftPickerSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const isVisible = props.recipient !== null;
  const runningBattleId = props.battle?.state === "active" ? props.battle.id : null;
  const gifting = useSendBattleGiftToStreamer({
    liveId: props.liveId,
    recipientUserId: props.recipient?.user.id ?? null,
    runningBattleId,
    signedInUserId: props.signedInUserId,
    isPickerOpen: isVisible,
    onStageUpdated: props.onStageUpdated,
  });
  const gifts = gifting.gifts;
  const selectedGift = gifts.find((gift) => gift.id === selectedGiftId) ?? null;
  const recipientName = props.recipient?.user.name ?? "";

  return (
    <>
      <BottomSheet visible={isVisible && !gifting.hasNotEnoughCoins} onClose={props.onClose} title={`Gift ${recipientName}`} floating>
        <View style={styles.body}>
          <View style={styles.recipientRow}>
            <Avatar uri={props.recipient?.user.avatarUrl} size={28} />
            <Text size={13} lineHeight={17} color={colors.textMuted} style={styles.flex}>
              {runningBattleId ? `Every coin adds to ${recipientName}'s battle score.` : `Your gift goes straight to ${recipientName}.`}
            </Text>
            <CoinBalanceChip />
          </View>
          {props.recipient && !props.recipient.isCreatorProgramMember ? (
            <Text size={12} lineHeight={16} color={colors.textMuted}>
              {recipientName} isn't in the Creator Program yet, so coins from this gift are paid to the host, {props.hostName}. It still counts toward {recipientName}'s score.
            </Text>
          ) : null}
          {gifting.isLoadingGifts ? <BrandLoader size="md" /> : null}
          <View style={styles.grid}>
            {gifts.map((gift) => {
              const isSelected = gift.id === selectedGiftId;
              return (
                <Pressable
                  key={gift.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${gift.name}, ${formatCoinAmount(gift.priceCoins)}`}
                  onPress={() => {
                    setSelectedGiftId(gift.id);
                    gifting.dismissGiftError();
                  }}
                  style={[styles.giftTile, isSelected ? styles.giftTileSelected : null]}
                >
                  <LiveGiftArtwork assetKey={gift.previewAssetKey} size={34} />
                  <Text size={11} weight={500} lineHeight={14} numberOfLines={1}>
                    {gift.name}
                  </Text>
                  <IconRow icon={<Coin24Icon size={12} />} justify="center" gap={3}>
                    <Text size={10} lineHeight={12} color={colors.textMuted}>
                      {gift.priceCoins.toLocaleString("en-US")}
                    </Text>
                  </IconRow>
                </Pressable>
              );
            })}
          </View>
          {gifting.giftSendingErrorMessage ? (
            <Text size={12} lineHeight={16} color={colors.error} accessibilityLiveRegion="polite">
              {gifting.giftSendingErrorMessage}
            </Text>
          ) : null}
          <Button
            title={selectedGift ? `Send to ${recipientName} · ${formatCoinAmount(selectedGift.priceCoins)}` : "Choose a gift"}
            disabled={!selectedGift}
            loading={gifting.isSendingGift}
            onPress={() => selectedGift && gifting.sendLiveGift(selectedGift, 1)}
          />
        </View>
      </BottomSheet>
      <BuyCoinsSheet visible={isVisible && gifting.hasNotEnoughCoins} onClose={gifting.dismissGiftError} />
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 20, gap: 14 },
  flex: { flex: 1 },
  recipientRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  giftTile: {
    width: "23%",
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 2,
  },
  giftTileSelected: { borderColor: colors.primarySolid, backgroundColor: colors.primaryTint },
}));
