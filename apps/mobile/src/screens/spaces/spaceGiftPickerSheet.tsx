import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CoinBalanceChip } from "@/components/coins/coinBalanceChip";
import { BuyCoinsSheet } from "@/components/coins/buyCoinsSheet";
import { COIN_BALANCE_QUERY_KEY, describeCoinError, useCoinBalance } from "@/components/coins/coinWallet.hook";
import { CoinAmountWithIcon } from "@/components/coins/coinAmount";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "@/components/ui/brandLoader";
import { Text } from "@/components/ui/text";
import { useLiveGiftCatalog } from "@/components/live/gifts/liveGiftCatalog.hook";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { spacesService, type SpacePerson } from "@/services/spaces.service";
import { showToast } from "@/store/toast.store";
import { makeThemedStyles, useTheme } from "@/theme";

interface SpaceGiftPickerSheetProps {
  readonly spaceId: string;
  readonly host: SpacePerson;
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function SpaceGiftPickerSheet({ spaceId, host, visible, onClose }: SpaceGiftPickerSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const client = useQueryClient();
  const { catalog, giftsById } = useLiveGiftCatalog(visible);
  useCoinBalance(visible);
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [buyCoinsOpen, setBuyCoinsOpen] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const sendGift = useMutation({
    mutationFn: () => {
      if (!selectedGiftId) throw new Error("Choose a gift first.");
      idempotencyKey.current ??= generateIdempotencyKey();
      return spacesService.sendGift(spaceId, selectedGiftId, idempotencyKey.current);
    },
    onSuccess: async () => {
      idempotencyKey.current = null;
      await client.invalidateQueries({ queryKey: COIN_BALANCE_QUERY_KEY });
      showToast(`Gift credited to ${host.name}.`, { tone: "success" });
      onClose();
    },
  });
  const gifts = [...giftsById.values()].filter((gift) => gift.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const selected = selectedGiftId ? giftsById.get(selectedGiftId) : undefined;

  return (
    <>
      <BottomSheet visible={visible && !buyCoinsOpen} onClose={onClose} title={`Gift ${host.name}`} subtitle="Your gift is credited to the creator. No on-screen effects." floating scrollable>
        <View style={styles.content}>
          <CoinBalanceChip onPress={() => setBuyCoinsOpen(true)} />
          {catalog.isPending ? <BrandLoader size="md" /> : null}
          {catalog.isError ? <Text color={colors.error}>Gifts are unavailable right now. Try again later.</Text> : null}
          {!catalog.isPending && !catalog.isError && gifts.length === 0 ? <Text color={colors.textMuted}>No gifts are available right now.</Text> : null}
          <View style={styles.list}>
            {gifts.map((gift) => {
              const isSelected = selectedGiftId === gift.id;
              return (
                <Pressable
                  key={gift.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${gift.name}, ${gift.priceCoins} coins`}
                  onPress={() => { setSelectedGiftId(gift.id); sendGift.reset(); idempotencyKey.current = null; }}
                  style={[styles.gift, isSelected ? styles.giftSelected : null]}
                >
                  <View style={styles.giftCopy}>
                    <Text weight={600}>{gift.name}</Text>
                    {gift.description ? <Text size={12} color={colors.textMuted}>{gift.description}</Text> : null}
                  </View>
                  <CoinAmountWithIcon label={gift.priceCoins.toLocaleString("en-US")} />
                </Pressable>
              );
            })}
          </View>
          {sendGift.isError ? <Text accessibilityRole="alert" color={colors.error}>{describeCoinError(sendGift.error)}</Text> : null}
          <Button
            title={selected ? `Send ${selected.name} · ${selected.priceCoins.toLocaleString("en-US")} coins` : "Choose a gift"}
            disabled={!selected || sendGift.isPending || catalog.isError}
            loading={sendGift.isPending}
            onPress={() => sendGift.mutate()}
          />
        </View>
      </BottomSheet>
      <BuyCoinsSheet visible={visible && buyCoinsOpen} onClose={() => setBuyCoinsOpen(false)} />
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 18, gap: 14 },
  list: { gap: 8 },
  gift: { minHeight: 58, borderRadius: 8, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  giftSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  giftCopy: { flex: 1, gap: 3 },
}));
