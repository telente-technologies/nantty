import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { CatalogProductVariant } from "@/types/sellerCatalog.type";

export interface VariantPreviewRow {
  readonly combination: Readonly<Record<string, string>>;
  readonly match: CatalogProductVariant | undefined;
}

export interface ProductVariantsPreviewProps {
  readonly rows: readonly VariantPreviewRow[];
  readonly priceLabel: string | null;
  readonly stockPerVariant: string | null;
}

const onHandOf = (variant: CatalogProductVariant) => variant.stock.reduce((sum, level) => sum + level.onHand - level.reserved, 0);

export function ProductVariantsPreview({ rows, priceLabel, stockPerVariant }: ProductVariantsPreviewProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (rows.length < 2 && Object.keys(rows[0]?.combination ?? {}).length === 0) return null;
  return (
    <View style={styles.wrap} accessibilityLabel={`${rows.length} variants`}>
      <Text size={14} weight={600} lineHeight={16.8}>Variants ({rows.length})</Text>
      <Text size={12} lineHeight={16.8} color={colors.textSubtle}>Each combination is sold separately. They share the price{stockPerVariant !== null ? " and start with the same stock" : ""}. Edit them one by one in the seller dashboard.</Text>
      <View style={styles.list}>
        {rows.map(({ combination, match }) => {
          const title = Object.values(combination).join(" / ");
          const detail = match
            ? `${match.sku} · ${onHandOf(match)} in stock`
            : [priceLabel, stockPerVariant !== null ? `${stockPerVariant || "0"} in stock` : null, "New"].filter(Boolean).join(" · ");
          return (
            <View key={title} style={styles.row} accessible accessibilityLabel={`${title}, ${detail}`}>
              <Text size={13} weight={500} lineHeight={16.9} numberOfLines={1} style={styles.title}>{title}</Text>
              <Text size={12} lineHeight={16} color={colors.textMuted} numberOfLines={1}>{detail}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  wrap: { gap: 8 },
  list: { borderRadius: 12, borderWidth: 1, borderColor: colors.divider, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  title: { flexShrink: 1 },
}));
