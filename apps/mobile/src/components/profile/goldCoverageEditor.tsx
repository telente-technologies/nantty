import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";

import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { typeScale } from "@/constants/typography.constant";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { goldForBusinessesService } from "@/services/money/goldForBusinesses.service";
import { useTheme } from "@/theme";
import type { GoldForBusinessesOverview, GoldForBusinessesSubscription } from "@/types/goldForBusinesses.type";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { describeGoldForBusinessesFailure, toggleGoldProfileSelection } from "@/utils/goldForBusinessesQuote.util";

import { GoldBusinessPicker } from "./goldBusinessPicker";
import { goldForBusinessesQueryKeys, useGoldForBusinessesQuote } from "./goldForBusinesses.hook";
import { GoldQuoteBreakdown } from "./goldQuoteBreakdown";

const sameSelection = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id) => b.includes(id));

export function GoldCoverageEditor({ overview, subscription }: { readonly overview: GoldForBusinessesOverview; readonly subscription: GoldForBusinessesSubscription }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const covered = subscription.coveredProfiles.filter((profile) => profile.coverage !== "removing").map((profile) => profile.profileId);
  const [selected, setSelected] = useState<readonly string[]>(covered);
  const idempotencyKey = useRef(generateIdempotencyKey());
  const changed = !sameSelection(selected, covered) && selected.length > 0;
  const quote = useGoldForBusinessesQuote(selected, subscription.interval, overview.premium && changed);
  const periodEnd = subscription.currentPeriodEnd ? formatFriendlyDate(subscription.currentPeriodEnd) : "the end of this period";
  const change = useMutation({
    mutationFn: () => goldForBusinessesService.changeCoveredBusinesses(subscription.id, { profileIds: selected }, idempotencyKey.current),
    onSuccess: (result) => {
      idempotencyKey.current = generateIdempotencyKey();
      queryClient.invalidateQueries({ queryKey: goldForBusinessesQueryKeys.overview });
      if (result.actionUrl) void WebBrowser.openBrowserAsync(result.actionUrl);
    },
  });
  const confirm = () =>
    showAlertWithButtons(
      "Update covered businesses?",
      `Businesses you add are charged now on your saved card, prorated for the rest of this period. Businesses you remove keep Gold until ${periodEnd} and leave the plan at renewal.`,
      [{ text: "Cancel", style: "cancel" }, { text: "Update", onPress: () => change.mutate() }],
    );
  const result = change.data;
  return (
    <>
      <Text size={typeScale.sm} lineHeight={17.5}>
        {formatMoneyForDisplay(subscription.price)} / {subscription.interval} · {subscription.cancelAtPeriodEnd ? `Ends ${periodEnd}` : `Renews ${periodEnd}`}
      </Text>
      <Text size={typeScale.sm} weight={500} lineHeight={17.5}>Covered businesses</Text>
      <GoldBusinessPicker businesses={overview.businesses} selected={selected} onToggle={(profileId) => setSelected((previous) => toggleGoldProfileSelection(previous, profileId, overview.rules.maximumProfiles))} />
      {!overview.premium ? <Text size={12} lineHeight={16} color={colors.textMuted}>Your Premium has ended. Covered businesses keep Gold and the plan renews at full price. Get Blue Premium again to add businesses.</Text> : null}
      {changed && quote.data ? (
        <>
          <Text size={12} lineHeight={16} color={colors.textMuted}>New price from your next renewal:</Text>
          <GoldQuoteBreakdown quote={quote.data} updating={quote.isPlaceholderData || quote.isFetching} />
        </>
      ) : null}
      {changed ? <Text size={12} lineHeight={16} color={colors.textMuted}>Added businesses are charged now, prorated. Removed businesses keep Gold until {periodEnd}.</Text> : null}
      {change.isError ? <Text size={12} lineHeight={16} color={colors.error}>{describeGoldForBusinessesFailure(change.error, "We couldn't update your businesses. Try again.")}</Text> : null}
      {result ? (
        <Text size={12} lineHeight={16} color={colors.textMuted}>
          {result.charge.amountDueMinor > 0 ? `Charged ${formatMoneyForDisplay({ amountMinor: result.charge.amountDueMinor, currency: subscription.price.currency })} now (prorated). ` : ""}
          {result.removing.length > 0 ? `Removals take effect on ${formatFriendlyDate(result.removalsEffectiveAt)}.` : ""}
          {result.chargeStatus === "requires_action" || result.chargeStatus === "pending" ? " Finish the payment in the page we opened." : ""}
          {result.chargeStatus === "failed" ? " The charge didn't go through. Check your card on the web." : ""}
        </Text>
      ) : null}
      <Button title="Update covered businesses" disabled={!changed} loading={change.isPending} onPress={confirm} />
    </>
  );
}
