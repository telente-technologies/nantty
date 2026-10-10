import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Flame24Icon, Medal24Icon, Trophy24Icon } from "@/components/icons";
import { BuyCoinsSheet } from "@/components/coins/buyCoinsSheet";
import { CoinBalanceChip } from "@/components/coins/coinBalanceChip";
import { useCoinBalance } from "@/components/coins/coinWallet.hook";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import type { LiveGift } from "@/types";
import { makeThemedStyles, useTheme } from "@/theme";

import { type LiveGiftPanelSection, useLiveGiftCatalog } from "./liveGiftCatalog.hook";
import { LiveGiftComboButton } from "./liveGiftComboButton";
import { LiveGiftPickerTile } from "./liveGiftPickerTile";
import { LIVE_GIFT_COMBO_WINDOW_MS, useSendLiveGift } from "./sendLiveGift.hook";

const QUANTITY_OPTIONS = [1, 5, 10, 50, 100] as const;
const PANEL_SECTIONS: readonly { readonly key: LiveGiftPanelSection; readonly label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "premium", label: "Premium" },
  { key: "legendary", label: "Legendary" },
];

export interface LiveGiftPickerSheetProps {
  readonly liveId: string;
  readonly recipientUserId?: string;
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function LiveGiftPickerSheet({ liveId, recipientUserId, visible, onClose }: LiveGiftPickerSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [section, setSection] = useState<LiveGiftPanelSection>("popular");
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [isBuyCoinsOpen, setIsBuyCoinsOpen] = useState(false);
  const { catalog, giftsBySection } = useLiveGiftCatalog(visible);
  useCoinBalance(visible);
  const sender = useSendLiveGift({ liveId, recipientUserId });

  useEffect(() => {
    if (sender.hasNotEnoughCoins) setIsBuyCoinsOpen(true);
  }, [sender.hasNotEnoughCoins]);

  const sendGiftOnce = (gift: LiveGift) => {
    setSelectedGiftId(gift.id);
    return sender.sendLiveGift(gift, gift.comboable ? quantity : 1);
  };
  const closeBuyCoins = () => {
    setIsBuyCoinsOpen(false);
    sender.dismissGiftError();
  };
  const comboGift = sender.comboWindow?.gift.comboable ? sender.comboWindow : null;

  return (
    <>
      <BottomSheet visible={visible && !isBuyCoinsOpen} onClose={onClose} title="Send a gift" subtitle="Your gift appears on screen for everyone" floating>
        <View style={styles.body}>
          <View style={styles.balanceRow}>
            <CoinBalanceChip onPress={() => setIsBuyCoinsOpen(true)} />
            <Pressable accessibilityRole="button" accessibilityLabel="Recharge coins" hitSlop={8} onPress={() => setIsBuyCoinsOpen(true)} style={styles.recharge}>
              <Text size={13} weight={600} lineHeight={16} color={colors.onPrimary}>
                Recharge
              </Text>
            </Pressable>
          </View>
          <View style={styles.tabs} accessibilityRole="tablist">
            {PANEL_SECTIONS.map((tab) => (
              <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: section === tab.key }} onPress={() => setSection(tab.key)} style={styles.tab}>
                {tab.key === "popular" ? (
                  <Flame24Icon size={20} color={section === tab.key ? colors.text : colors.textMuted} />
                ) : tab.key === "premium" ? (
                  <Medal24Icon size={20} color={section === tab.key ? colors.text : colors.textMuted} />
                ) : (
                  <Trophy24Icon size={20} color={section === tab.key ? colors.text : colors.textMuted} />
                )}
                <Text size={14} weight={section === tab.key ? 700 : 500} lineHeight={18} color={section === tab.key ? colors.text : colors.textMuted}>
                  {tab.label}
                </Text>
                {section === tab.key ? <View style={styles.tabUnderline} /> : null}
              </Pressable>
            ))}
          </View>
          {catalog.isPending ? <ActivityIndicator color={colors.primary} /> : null}
          <View style={styles.grid}>
            {giftsBySection[section].map((gift) => (
              <LiveGiftPickerTile key={gift.id} gift={gift} isSelected={gift.id === selectedGiftId} onSendOnce={sendGiftOnce} />
            ))}
          </View>
          {section === "popular" ? (
            <View style={styles.quantityRow} accessibilityLabel="Gifts per tap">
              {QUANTITY_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: quantity === option }}
                  accessibilityLabel={`Send ${option} per tap`}
                  onPress={() => setQuantity(option)}
                  style={[styles.quantityChip, quantity === option ? styles.quantityChipSelected : null]}
                >
                  <Text size={13} weight={600} lineHeight={16} color={quantity === option ? colors.onPrimary : colors.text}>
                    ×{option}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text size={12} lineHeight={16} color={sender.giftSendingErrorMessage ? colors.error : colors.textMuted} accessibilityLiveRegion="polite">
            {sender.giftSendingErrorMessage ?? "Tap a gift to send it. Hold to keep sending."}
          </Text>
        </View>
        {comboGift ? (
          <LiveGiftComboButton
            comboWindow={comboGift}
            windowMs={LIVE_GIFT_COMBO_WINDOW_MS}
            onComboTap={() => sendGiftOnce(comboGift.gift)}
            onWindowEnded={sender.endComboWindow}
          />
        ) : null}
      </BottomSheet>
      <BuyCoinsSheet visible={visible && isBuyCoinsOpen} onClose={closeBuyCoins} />
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  balanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recharge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primarySolid },
  tabs: { flexDirection: "row", gap: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 8 },
  tabUnderline: { position: "absolute", left: 0, right: 0, bottom: -1, height: 2, borderRadius: 1, backgroundColor: colors.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: "2%", rowGap: 6, minHeight: 180 },
  quantityRow: { flexDirection: "row", gap: 8 },
  quantityChip: { flex: 1, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.divider, alignItems: "center" },
  quantityChipSelected: { backgroundColor: colors.primarySolid, borderColor: colors.primarySolid },
}));
