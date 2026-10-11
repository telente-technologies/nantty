import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Share, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ProviderWallet } from "@/types/providerWallet.type";

export function walletShareText(wallet: ProviderWallet): string {
  return `Send money to my Zudomart wallet\nBank: ${wallet.bankName}\nAccount number: ${wallet.accountNumber}\nAccount name: ${wallet.accountName}`;
}

function DetailRow({ label, value }: { readonly label: string; readonly value: string }) {
  const { colors } = useTheme();
  return (
    <View style={rowStyles.row}>
      <Text size={12} lineHeight={16} color={colors.textMuted}>{label}</Text>
      <Text size={16} weight={600} lineHeight={20} selectable>{value}</Text>
    </View>
  );
}

export function WalletAccountDetails({ wallet }: { readonly wallet: ProviderWallet }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(wallet.accountNumber).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  const extraNumbers = wallet.fundingNumbers.filter((number) => number.accountNumber !== wallet.accountNumber);
  return (
    <View style={styles.card} accessibilityRole="summary">
      <DetailRow label="Bank" value={wallet.bankName} />
      <DetailRow label="Account number" value={wallet.accountNumber} />
      <DetailRow label="Account name" value={wallet.accountName} />
      {extraNumbers.map((number) => (
        <Text key={number.accountNumber} size={12} lineHeight={16} color={colors.textMuted}>
          Also works: {number.bankName} {number.accountNumber}
        </Text>
      ))}
      <View style={styles.actions}>
        <Button title={copied ? "Copied" : "Copy account number"} height={40} style={styles.flex} onPress={() => void copy()} accessibilityLabel="Copy your wallet account number" />
        <Button variant="subtle" title="Share" height={40} style={styles.flex} onPress={() => void Share.share({ message: walletShareText(wallet) }).catch(() => undefined)} />
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({ row: { gap: 2 } });

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.primaryTint, borderRadius: 12, padding: 16, gap: 12 },
  actions: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
}));
