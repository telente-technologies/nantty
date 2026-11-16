import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { CountryRequiredPicker } from "@/components/checkout/countryRequiredPicker";
import { Coin24Icon, CreditCard24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { CoinBalanceChip } from "./coinBalanceChip";
import { describeCoinError, formatCoinAmount, useBuyCoinsWithInAppBrowser, type CoinPurchaseOutcome } from "./coinWallet.hook";
import { CoinAmountWithIcon } from "./coinAmount";

const describePurchaseOutcome = (outcome: CoinPurchaseOutcome) => {
  if (outcome.kind === "credited") return `${formatCoinAmount(outcome.coins)} added to your balance.`;
  if (outcome.kind === "pending") return "Your payment is still being confirmed. Your coins will appear shortly.";
  if (outcome.kind === "availableOnWebsiteOnly") return "Coin purchases are available on nantty.com";
  return "The payment wasn't completed. You have not been charged.";
};

export function BuyCoinsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { coinPackages, buyCoinPackage, lastOutcome, countryNeededFor, clearCountryNeeded } = useBuyCoinsWithInAppBrowser();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Buy coins" floating scrollable>
      <View style={styles.body}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
            <Coin24Icon size={22} color={colors.textMuted} />
          </View>
          <CoinBalanceChip />
        </View>
        {countryNeededFor ? (
          <CountryRequiredPicker
            onSaved={() => {
              clearCountryNeeded();
              buyCoinPackage.mutate(countryNeededFor);
            }}
          />
        ) : null}
        {coinPackages.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {(coinPackages.data ?? []).map((coinPackage) => (
          <Pressable
            key={coinPackage.id}
            accessibilityRole="button"
            accessibilityLabel={`Buy ${formatCoinAmount(coinPackage.coins + (coinPackage.bonusCoins ?? 0))} for ${formatMoneyForDisplay(coinPackage.price)}`}
            disabled={buyCoinPackage.isPending}
            onPress={() => buyCoinPackage.mutate(coinPackage)}
            style={styles.packageRow}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <CreditCard24Icon size={20} color={colors.textMuted} />
              <View>
                <CoinAmountWithIcon label={formatCoinAmount(coinPackage.coins)} />
                {coinPackage.bonusCoins ? (
                  <Text size={12} lineHeight={14.4} color={colors.success}>
                    +{coinPackage.bonusCoins.toLocaleString("en-US")} bonus
                  </Text>
                ) : null}
                {coinPackage.billingNote ? (
                  <Text size={11} lineHeight={14.4} color={colors.textMuted}>
                    {coinPackage.billingNote}
                  </Text>
                ) : null}
              </View>
            </View>
            <Text size={14} weight={600} lineHeight={16.8} color={colors.primary}>
              {formatMoneyForDisplay(coinPackage.price)}
            </Text>
          </Pressable>
        ))}
        {buyCoinPackage.isPending ? (
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            Complete the payment in the secure browser. We'll confirm it with our server when you return.
          </Text>
        ) : null}
        {lastOutcome ? (
          <Text size={13} lineHeight={16.9} color={lastOutcome.kind === "credited" ? colors.success : colors.textMuted} accessibilityLiveRegion="polite">
            {describePurchaseOutcome(lastOutcome)}
          </Text>
        ) : null}
        {buyCoinPackage.isError && !countryNeededFor ? (
          <Text size={13} lineHeight={16.9} color={colors.error}>
            {describeCoinError(buyCoinPackage.error)}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingBottom: 4, gap: 12 },
  packageRow: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
}));
