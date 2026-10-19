import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { CreateAdPaymentPicker } from "@/components/ads/createAdPaymentPicker";
import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { describeActionFailure } from "@/errors/errorExperience/describeError";
import { adsHubService } from "@/services/ads/adsHub.service";
import { paymentsService } from "@/services/commerce/payments.service";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Boost, BoostOptions, BoostPaymentMethod } from "@/types/boost.type";
import type { Money } from "@/types";
import { boostPaymentChoices, buildBudgetChangeInput, createStableIdempotencyKeys, parseMoneyInput, resolvePaymentMethod } from "@/utils/adsHub.util";
import { boostErrorMessage } from "@/utils/boostPayment.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const EXTRA_DAY_CHOICES = [0, 1, 3, 7, 14] as const;
const DAILY_INCREASE_MULTIPLIERS = [1, 1.5, 2, 3] as const;

export interface BoostBudgetChangeSheetProps {
  readonly visible: boolean;
  readonly boost: Boost;
  readonly options: BoostOptions | undefined;
  readonly onClose: () => void;
}

export function BoostBudgetChangeSheet({ visible, boost, options, onClose }: BoostBudgetChangeSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [extraDays, setExtraDays] = useState(0);
  const [dailyBudget, setDailyBudget] = useState<Money | null>(boost.dailyBudget ?? null);
  const [additionalText, setAdditionalText] = useState("");
  const [chosenMethod, setChosenMethod] = useState<BoostPaymentMethod | null>(null);
  const idempotencyKeys = useRef(createStableIdempotencyKeys(generateIdempotencyKey)).current;
  const currency = boost.totalBudget.currency;
  const input = buildBudgetChangeInput(boost, extraDays, dailyBudget, parseMoneyInput(additionalText, currency));
  const quote = useQuery({ queryKey: ["ads", "budgetQuote", boost.id, input], queryFn: () => adsHubService.quoteBoostBudgetChange(boost.id, input!), enabled: visible && !!input });
  const choices = quote.data
    ? boostPaymentChoices({ ...(options ?? { minimumDailyBudget: boost.totalBudget, suggestedDailyBudgets: [], durationDayOptions: [], interests: [] }), paymentOptions: quote.data.paymentOptions }, quote.data.additionalCost)
    : [];
  const paymentMethod = resolvePaymentMethod(choices, chosenMethod);
  const apply = useMutation({
    mutationFn: async () => {
      const body = { ...input!, paymentMethod: paymentMethod as "card" | "ad_balance" };
      const result = await adsHubService.applyBoostBudgetChange(boost.id, body, idempotencyKeys.keyFor(body));
      if (result.checkoutUrl) await paymentsService.openHostedCheckoutInAppBrowser(result.checkoutUrl);
      return result;
    },
    onSuccess: (result) => {
      idempotencyKeys.reset();
      queryClient.setQueryData(["boosts", boost.id], result.boost);
      void queryClient.invalidateQueries({ queryKey: ["ads"] });
      void queryClient.invalidateQueries({ queryKey: ["boosts", "options"] });
      onClose();
    },
  });
  const dailyChoices = boost.dailyBudget
    ? DAILY_INCREASE_MULTIPLIERS.map((multiple) => ({ amountMinor: Math.round(boost.dailyBudget!.amountMinor * multiple), currency: boost.dailyBudget!.currency }))
    : [];
  const canPay = !!input && !!quote.data && (paymentMethod === "card" || paymentMethod === "ad_balance");
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Extend or increase budget" scrollable>
      <View style={styles.root}>
        <Text size={13} weight={600} lineHeight={16.9}>Add days</Text>
        <View style={styles.chips}>
          {EXTRA_DAY_CHOICES.map((days) => <Chip key={days} label={days === 0 ? "No extra days" : `+${days} ${days === 1 ? "day" : "days"}`} selected={extraDays === days} onPress={() => setExtraDays(days)} />)}
        </View>
        {boost.budgetType === "total" ? (
          <TextField label="Add to the total budget" keyboardType="decimal-pad" value={additionalText} onChangeText={setAdditionalText} accessibilityLabel={`Amount to add to the total budget in ${currency}`} />
        ) : dailyChoices.length > 0 ? (
          <>
            <Text size={13} weight={600} lineHeight={16.9}>Daily budget</Text>
            <View style={styles.chips}>
              {dailyChoices.map((choice, index) => (
                <Chip key={choice.amountMinor} label={index === 0 ? `Keep ${formatMoneyForDisplay(choice, { showDecimals: false })}` : `${formatMoneyForDisplay(choice, { showDecimals: false })} a day`} selected={dailyBudget?.amountMinor === choice.amountMinor} onPress={() => setDailyBudget(choice)} />
              ))}
            </View>
          </>
        ) : null}
        <View style={styles.quote} accessibilityLiveRegion="polite">
          {!input ? <Text size={13} lineHeight={16.9} color={colors.textMuted}>Add days or raise the budget to see the price.</Text> : null}
          {input && quote.isFetching && !quote.data ? <ActivityIndicator color={colors.primary} accessibilityLabel="Getting the price" /> : null}
          {quote.isError ? <Text size={12} lineHeight={16} color={colors.error}>{boostErrorMessage(quote.error) || describeActionFailure(quote.error)}</Text> : null}
          {quote.data && input ? (
            <>
              <Text size={16} weight={600} lineHeight={20}>You pay {formatMoneyForDisplay(quote.data.additionalCost)} more</Text>
              <Text size={12} lineHeight={16} color={colors.textMuted}>
                New budget {formatMoneyForDisplay(quote.data.newTotalBudget)} · {formatMoneyForDisplay(quote.data.newDailyBudget)} a day · {quote.data.newDurationDays} days{quote.data.newEndsAt ? ` · ends ${formatFriendlyDate(quote.data.newEndsAt)}` : ""}
              </Text>
            </>
          ) : null}
        </View>
        {quote.data && input ? <CreateAdPaymentPicker choices={choices} selected={paymentMethod} onSelect={setChosenMethod} /> : null}
        {apply.isError ? <Text size={12} lineHeight={16} color={colors.error} accessibilityLiveRegion="assertive">{boostErrorMessage(apply.error)}</Text> : null}
        <Button title={quote.data && input ? `Pay ${formatMoneyForDisplay(quote.data.additionalCost)}` : "Pay"} disabled={!canPay} loading={apply.isPending} onPress={() => apply.mutate()} />
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 10, paddingBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quote: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 4 },
}));
