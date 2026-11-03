import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";
import { walletsService } from "@/services/money/wallets.service";
import { useAuthStore } from "@/store/auth.store";
import { makeThemedStyles } from "@/theme";
import type { WalletSummary } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { formatCoinCount } from "@/utils/walletLines.util";

interface WalletHomePreviewProps {
  readonly onPressWallet: () => void;
}

export function WalletHomePreview({ onPressWallet }: WalletHomePreviewProps) {
  const styles = useStyles();
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => (state.status === "signedIn" ? state.user?.id ?? null : null));
  const wallet = useQuery({
    queryKey: ["wallet", "balance", "home-preview", userId],
    queryFn: async () => {
      const current = useAuthStore.getState();
      if (current.status !== "signedIn" || current.user?.id !== userId) throw new Error("The active account changed. Retry to refresh your wallet.");
      return walletsService.fetchMyWalletBalance();
    },
    enabled: status === "signedIn" && userId !== null,
    staleTime: 30_000,
    retry: 1,
  });

  if (status !== "signedIn" || !userId) return null;

  return (
    <View style={styles.card} accessibilityLabel="Wallet summary">
      <View style={styles.heading}>
        <Text size={typeScale.md} weight={500} lineHeight={19.2}>Wallet</Text>
        <Button title="View wallet" variant="subtle" height={36} onPress={onPressWallet} />
      </View>
      {wallet.isPending ? (
        <View style={styles.state} accessibilityRole="progressbar" accessibilityLabel="Loading wallet summary" testID="wallet-preview-loading">
          <Text size={typeScale.sm} lineHeight={18}>Loading wallet…</Text>
        </View>
      ) : wallet.isError || !wallet.data ? (
        <View style={styles.state}>
          <Text size={typeScale.sm} lineHeight={18}>Wallet summary could not be loaded.</Text>
          <Button title="Retry" variant="subtle" height={36} onPress={() => void wallet.refetch()} loading={wallet.isFetching} />
        </View>
      ) : (
        <WalletAmounts wallet={wallet.data} />
      )}
    </View>
  );
}

function WalletAmounts({ wallet }: { readonly wallet: WalletSummary }) {
  const styles = useStyles();
  const escrow = wallet.inEscrow ?? wallet.pending;
  return (
    <View style={styles.amounts}>
      <Amount label="Available" value={formatMoneyForDisplay(wallet.available)} />
      <Amount label="In escrow" value={escrow ? formatMoneyForDisplay(escrow) : "—"} />
      <Amount label="Coins" value={wallet.coins ? formatCoinCount(wallet.coins.spendable) : "0 coins"} />
    </View>
  );
}

function Amount({ label, value }: { readonly label: string; readonly value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.amount}>
      <Text size={typeScale.xs} lineHeight={16.8} numberOfLines={1}>{label}</Text>
      <Text size={typeScale.sm} weight={500} lineHeight={19.2} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { marginHorizontal: spacing[4], marginTop: spacing[3], marginBottom: spacing[2], padding: spacing[3], gap: spacing[3], backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider, borderRadius: 12 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[3] },
  amounts: { flexDirection: "row", gap: spacing[2] },
  amount: { flex: 1, minWidth: 0, gap: spacing[1] },
  state: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[3], minHeight: 36 },
}));
