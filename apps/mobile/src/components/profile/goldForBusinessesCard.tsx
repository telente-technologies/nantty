import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Text } from "@/components/ui/text";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";
import { webHandoffService } from "@/services/core/webHandoff.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { GoldForBusinessesInterval, GoldForBusinessesOverview } from "@/types/goldForBusinesses.type";
import {
  describeGoldForBusinessesFailure, GOLD_FOR_BUSINESSES_PREMIUM_UPSELL, GOLD_FOR_BUSINESSES_TITLE, goldTierRows, percentFromBasisPoints, toggleGoldProfileSelection,
} from "@/utils/goldForBusinessesQuote.util";

import { GoldBusinessPicker } from "./goldBusinessPicker";
import { GoldCoverageEditor } from "./goldCoverageEditor";
import { useGoldForBusinessesQuery, useGoldForBusinessesQuote } from "./goldForBusinesses.hook";
import { GoldQuoteBreakdown } from "./goldQuoteBreakdown";

export function GoldForBusinessesCard() {
  const { colors } = useTheme();
  const styles = useStyles();
  const overview = useGoldForBusinessesQuery();
  return (
    <View style={styles.card}>
      <Text size={typeScale.base} weight={600} lineHeight={19.2}>{GOLD_FOR_BUSINESSES_TITLE}</Text>
      <Text size={typeScale.sm} lineHeight={17.5} color={colors.textMuted}>
        One Gold plan covers up to 5 of your businesses. Each business still needs its own business verification for its Gold checkmark.
      </Text>
      {overview.isPending ? <ListSkeleton rows={2} padding={0} /> : null}
      {overview.isError ? <ErrorState error={overview.error} compact message="Couldn't load your businesses." onRetry={() => overview.refetch()} retrying={overview.isRefetching} /> : null}
      {overview.data ? <GoldForBusinessesBody overview={overview.data} /> : null}
    </View>
  );
}

function GoldForBusinessesBody({ overview }: { readonly overview: GoldForBusinessesOverview }) {
  const { colors } = useTheme();
  const tiers = goldTierRows(overview.rules);
  return (
    <>
      <View style={tierStyles.list} accessibilityLabel="Multi-business discounts">
        {tiers.map((tier) => (
          <View key={tier.key} style={tierStyles.row}>
            <Text size={12} lineHeight={16} color={colors.textMuted} style={tierStyles.label}>{tier.label}</Text>
            <Text size={12} weight={500} lineHeight={16}>{tier.value}</Text>
          </View>
        ))}
        <Text size={12} lineHeight={16} color={colors.textMuted}>Yearly billing takes an extra {percentFromBasisPoints(overview.rules.yearlyExtraBps)} off.</Text>
      </View>
      {overview.subscription ? (
        <GoldCoverageEditor overview={overview} subscription={overview.subscription} />
      ) : overview.premium ? (
        <GoldForBusinessesPurchase overview={overview} />
      ) : (
        <Text size={typeScale.sm} weight={500} lineHeight={17.5}>{GOLD_FOR_BUSINESSES_PREMIUM_UPSELL}</Text>
      )}
    </>
  );
}

function GoldForBusinessesPurchase({ overview }: { readonly overview: GoldForBusinessesOverview }) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [interval, setBillingInterval] = useState<GoldForBusinessesInterval>("month");
  const quote = useGoldForBusinessesQuote(selected, interval, true);
  const current = selected.length > 0 && quote.data && !quote.isPlaceholderData ? quote.data : null;
  const failure = selected.length > 0 && quote.isError ? describeGoldForBusinessesFailure(quote.error) : null;
  if (overview.businesses.length === 0) {
    return <Text size={typeScale.sm} lineHeight={17.5} color={colors.textMuted}>Create a Business page or Brand first, then cover it with Gold here.</Text>;
  }
  return (
    <>
      <GoldBusinessPicker businesses={overview.businesses} selected={selected} onToggle={(profileId) => setSelected((previous) => toggleGoldProfileSelection(previous, profileId, overview.rules.maximumProfiles))} />
      <View style={tierStyles.toggle} accessibilityRole="radiogroup">
        <Chip label="Monthly" selected={interval === "month"} onPress={() => setBillingInterval("month")} />
        <Chip label="Yearly" selected={interval === "year"} onPress={() => setBillingInterval("year")} />
      </View>
      {selected.length > 0 && quote.data ? <GoldQuoteBreakdown quote={quote.data} updating={quote.isPlaceholderData || quote.isFetching} /> : null}
      {selected.length > 0 && quote.isPending ? <ListSkeleton rows={2} padding={0} /> : null}
      {failure ? <Text size={12} lineHeight={16} color={colors.error}>{failure}</Text> : null}
      <Text size={12} lineHeight={16} color={colors.textMuted}>You'll pay on the Nantty website. The total there matches this price.</Text>
      <Button
        title="Continue on the web"
        disabled={!current || !current.canBuyOnWeb || quote.isFetching}
        onPress={() => current && webHandoffService.openGoldForBusinessesCheckout({ profileIds: selected, interval, expectedTotalMinor: current.total.amountMinor })}
      />
    </>
  );
}

const tierStyles = StyleSheet.create({
  list: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center" },
  label: { flex: 1 },
  toggle: { flexDirection: "row", gap: 8 },
});

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing[4], gap: spacing[2] },
}));
