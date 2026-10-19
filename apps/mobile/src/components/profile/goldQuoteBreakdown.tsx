import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { GoldForBusinessesQuote } from "@/types/goldForBusinesses.type";
import { goldQuoteBreakdownRows, goldQuotePerBusinessRows, type GoldQuoteRow } from "@/utils/goldForBusinessesQuote.util";

export function GoldQuoteBreakdown({ quote, updating }: { readonly quote: GoldForBusinessesQuote; readonly updating: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.box, updating ? styles.updating : null]} accessibilityLabel="Price breakdown" accessibilityState={{ busy: updating }}>
      {goldQuotePerBusinessRows(quote).map((row) => <QuoteRow key={row.key} row={row} muted />)}
      <View style={styles.divider} />
      {goldQuoteBreakdownRows(quote).map((row) => <QuoteRow key={row.key} row={row} />)}
      {quote.billingNote ? <Text size={12} lineHeight={16} color={colors.textMuted}>{quote.billingNote}</Text> : null}
    </View>
  );
}

function QuoteRow({ row, muted }: { readonly row: GoldQuoteRow; readonly muted?: boolean }) {
  const { colors } = useTheme();
  const color = muted ? colors.textMuted : colors.text;
  return (
    <View style={rowStyles.row}>
      <Text size={13} weight={row.emphasis ? 600 : 400} lineHeight={18} color={color} style={rowStyles.label}>{row.label}</Text>
      <Text size={13} weight={row.emphasis ? 600 : 500} lineHeight={18} color={color}>{row.value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { flex: 1 },
});

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  box: { gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, padding: 12 },
  updating: { opacity: 0.6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginVertical: 2 },
}));
