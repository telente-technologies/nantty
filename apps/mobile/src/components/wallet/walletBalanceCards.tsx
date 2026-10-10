import { StyleSheet, View } from "react-native";

import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Text } from "@/components/ui/text";
import { palette } from "@/constants/colors.constant";
import { makeThemedStyles, useTheme } from "@/theme";
import type { WalletLine, WalletSummary } from "@/types";
import { formatWalletLineAmount, walletLinesForDisplay } from "@/utils/walletLines.util";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export function WalletBalanceCards({ wallet }: { wallet: WalletSummary | undefined }) {
  const styles = useStyles();
  const lines = walletLinesForDisplay(wallet);
  if (!wallet) return <ListSkeleton rows={3} avatarSize={0} padding={0} />;
  return (
    <View style={styles.list}>
      {lines.map((line, index) => (line.key === "available" ? <AvailableLine key={`${line.key}:${index}`} line={line} /> : <WalletLineRow key={`${line.key}:${index}`} line={line} />))}
    </View>
  );
}

function AvailableLine({ line }: { line: WalletLine }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const amount = formatWalletLineAmount(line.amount);
  return (
    <View style={styles.available} accessible accessibilityLabel={`${line.label} ${amount}. ${line.description}`}>
      <Text size={typeScale.xs} weight={500} lineHeight={14.4} color={palette.primary[100]}>{line.label}</Text>
      <Text size={21} weight={600} lineHeight={25.2} color={colors.white} numberOfLines={1} adjustsFontSizeToFit>{amount}</Text>
      {line.description ? <Text size={typeScale.xs} lineHeight={16.8} color={palette.primary[100]}>{line.description}</Text> : null}
    </View>
  );
}

function WalletLineRow({ line }: { line: WalletLine }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const amount = formatWalletLineAmount(line.amount);
  const owed = line.key === "debts" && line.amount.amountMinor > 0;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${line.label} ${amount}. ${line.description}`}>
      <View style={styles.rowText}>
        <Text size={typeScale.md} weight={500} lineHeight={16.8}>{line.label}</Text>
        {line.description ? <Text size={typeScale.xs} lineHeight={16.8} color={colors.textMuted}>{line.description}</Text> : null}
      </View>
      <Text size={typeScale.md} weight={600} lineHeight={16.8} color={owed ? colors.error : colors.text} numberOfLines={1}>{amount}</Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { backgroundColor: colors.surface, borderRadius: 12, overflow: "hidden" },
  available: { backgroundColor: colors.primarySolid, padding: 14, gap: spacing[2] },
  row: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  rowText: { flex: 1, gap: 2 },
}));
