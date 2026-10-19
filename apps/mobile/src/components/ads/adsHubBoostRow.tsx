import { Pressable, StyleSheet, View } from "react-native";

import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { CaretRight16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Boost } from "@/types/boost.type";
import { boostKeyResult, boostSpendRatio, boostStatusAppearance } from "@/utils/adsHub.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

const DESTINATION_TITLES = { post: "Boosted post", profile: "Promoted profile", store: "Promoted store", product: "Promoted product" } as const;

export function AdsHubBoostRow({ boost, onPress }: { readonly boost: Boost; readonly onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const appearance = boostStatusAppearance(boost.status);
  const keyResult = boostKeyResult(boost);
  const spentLabel = `${formatMoneyForDisplay(boost.spent)} of ${formatMoneyForDisplay(boost.totalBudget)} spent`;
  const endLabel = boost.endsAt ? `Ends ${formatFriendlyDate(boost.endsAt)}` : boost.durationDays ? `Runs ${boost.durationDays} ${boost.durationDays === 1 ? "day" : "days"} after approval` : null;
  const title = DESTINATION_TITLES[boost.destinationType ?? "post"];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${appearance.label}. ${spentLabel}. ${keyResult.label} ${keyResult.value}.${endLabel ? ` ${endLabel}.` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <Text size={14} weight={600} lineHeight={16.8} style={styles.flex} numberOfLines={1}>{title}</Text>
        <StatusPill label={appearance.label} tone={appearance.tone} />
        <CaretRight16Icon size={16} color={colors.textMuted} />
      </View>
      <View style={styles.track} importantForAccessibility="no-hide-descendants">
        <View style={[styles.fill, { width: `${Math.round(boostSpendRatio(boost) * 100)}%` }]} />
      </View>
      <Text size={12} lineHeight={16} color={colors.textMuted}>{spentLabel}</Text>
      <View style={styles.bottom}>
        <Text size={12} weight={600} lineHeight={16}>{formatCountWithThousandsSuffix(keyResult.value)} {keyResult.label.toLowerCase()}</Text>
        {endLabel ? <Text size={12} lineHeight={16} color={colors.textMuted}>{endLabel}</Text> : null}
      </View>
      {boost.status === "rejected" && boost.rejectionReason ? <Text size={12} lineHeight={16} color={colors.error} numberOfLines={2}>{boost.rejectionReason}</Text> : null}
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 6 },
  pressed: { opacity: 0.85 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.divider, overflow: "hidden" },
  fill: { height: 4, backgroundColor: colors.primary },
  bottom: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
}));
