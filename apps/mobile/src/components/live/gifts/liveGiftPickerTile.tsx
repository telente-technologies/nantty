import { useEffect, useRef } from "react";
import { Pressable, StyleSheet } from "react-native";

import { CoinAmountWithIcon } from "@/components/coins/coinAmount";
import { Text } from "@/components/ui/text";
import type { LiveGift } from "@/types";
import { makeThemedStyles } from "@/theme";

import { LiveGiftArtwork } from "./liveGiftArtwork";

const HOLD_TO_SEND_INTERVAL_MS = 220;

export interface LiveGiftPickerTileProps {
  readonly gift: LiveGift;
  readonly isSelected: boolean;
  readonly onSendOnce: (gift: LiveGift) => boolean;
}

export function LiveGiftPickerTile({ gift, isSelected, onSendOnce }: LiveGiftPickerTileProps) {
  const styles = useStyles();
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopContinuousSending = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
  };
  const startContinuousSending = () => {
    if (!gift.comboable) return;
    stopContinuousSending();
    holdTimer.current = setInterval(() => {
      if (!onSendOnce(gift)) stopContinuousSending();
    }, HOLD_TO_SEND_INTERVAL_MS);
  };
  useEffect(() => stopContinuousSending, []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Send ${gift.name} for ${gift.priceCoins} coins`}
      accessibilityHint={gift.comboable ? "Hold to keep sending" : undefined}
      onPress={() => onSendOnce(gift)}
      onLongPress={startContinuousSending}
      onPressOut={stopContinuousSending}
      delayLongPress={350}
      style={({ pressed }) => [styles.tile, isSelected ? styles.selected : null, pressed ? styles.pressed : null]}
    >
      <LiveGiftArtwork assetKey={gift.previewAssetKey} size={44} />
      <Text size={12} weight={500} lineHeight={14.4} numberOfLines={1}>
        {gift.name}
      </Text>
      <CoinAmountWithIcon size={12} weight={700} label={gift.priceCoins.toLocaleString("en-US")} />
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  tile: { width: "23.5%", paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: "transparent", alignItems: "center", gap: 3 },
  selected: { borderColor: colors.primarySolid, backgroundColor: colors.primaryTint },
  pressed: { transform: [{ scale: 0.94 }] },
}));
