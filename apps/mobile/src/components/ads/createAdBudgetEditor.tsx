import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { BoostOptions } from "@/types/boost.type";
import {
  DURATION_DAY_CHOICES, SCHEDULE_START_OPTIONS, budgetBelowMinimum, minimumTotalBudget, parseMoneyInput, scheduledStartAt, type CreateAdDraft,
} from "@/utils/adsHub.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export interface CreateAdBudgetEditorProps {
  readonly draft: CreateAdDraft;
  readonly options: BoostOptions;
  readonly onChange: (patch: Partial<CreateAdDraft>) => void;
}

const daysLabel = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

export function CreateAdBudgetEditor({ draft, options, onChange }: CreateAdBudgetEditorProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const currency = options.minimumDailyBudget.currency;
  const [customDailyText, setCustomDailyText] = useState("");
  const [totalText, setTotalText] = useState(draft.totalBudget ? String(draft.totalBudget.amountMinor / 100) : "");
  const [startChoice, setStartChoice] = useState<number | null>(null);
  const maximumScheduleDays = options.maximumScheduleDays ?? 0;
  const startChoices = SCHEDULE_START_OPTIONS.filter((option) => option.daysAhead === null || option.daysAhead <= maximumScheduleDays);
  const minimumTotal = minimumTotalBudget(options, draft.durationDays);
  const belowMinimum = budgetBelowMinimum(draft, options);
  return (
    <View style={styles.root}>
      <Text size={14} weight={600} lineHeight={16.8}>Budget</Text>
      <View style={styles.chips}>
        <Chip label="Daily budget" selected={draft.budgetType === "daily"} onPress={() => onChange({ budgetType: "daily" })} />
        <Chip label="Total budget" selected={draft.budgetType === "total"} onPress={() => onChange({ budgetType: "total" })} />
      </View>
      {draft.budgetType === "daily" ? (
        <>
          <View style={styles.chips}>
            {options.suggestedDailyBudgets.map((budget) => (
              <Chip
                key={`${budget.currency}-${budget.amountMinor}`}
                label={`${formatMoneyForDisplay(budget, { showDecimals: false })} a day`}
                selected={draft.dailyBudget?.amountMinor === budget.amountMinor && !customDailyText}
                onPress={() => {
                  setCustomDailyText("");
                  onChange({ dailyBudget: budget });
                }}
              />
            ))}
          </View>
          <TextField
            label="Or enter a daily amount"
            keyboardType="decimal-pad"
            value={customDailyText}
            accessibilityLabel={`Daily budget in ${currency}`}
            onChangeText={(text) => {
              setCustomDailyText(text);
              const amount = parseMoneyInput(text, currency);
              if (amount) onChange({ dailyBudget: amount });
            }}
          />
          <Text size={12} lineHeight={16} color={colors.textMuted}>Minimum {formatMoneyForDisplay(options.minimumDailyBudget)} a day.</Text>
        </>
      ) : (
        <>
          <TextField
            label="Total for the whole ad"
            keyboardType="decimal-pad"
            value={totalText}
            accessibilityLabel={`Total budget in ${currency}`}
            onChangeText={(text) => {
              setTotalText(text);
              onChange({ totalBudget: parseMoneyInput(text, currency) });
            }}
          />
          {minimumTotal ? <Text size={12} lineHeight={16} color={colors.textMuted}>At least {formatMoneyForDisplay(minimumTotal)} for {daysLabel(draft.durationDays ?? 1)}.</Text> : null}
        </>
      )}
      {belowMinimum ? <Text size={12} lineHeight={16} color={colors.error} accessibilityLiveRegion="polite">This is below the minimum of {formatMoneyForDisplay(options.minimumDailyBudget)} a day.</Text> : null}
      <Text size={14} weight={600} lineHeight={16.8} style={styles.section}>How long</Text>
      <View style={styles.chips}>
        {DURATION_DAY_CHOICES(options).map((days) => (
          <Chip key={days} label={daysLabel(days)} selected={draft.durationDays === days} onPress={() => onChange({ durationDays: days })} />
        ))}
      </View>
      {startChoices.length > 1 ? (
        <>
          <Text size={14} weight={600} lineHeight={16.8} style={styles.section}>Start</Text>
          <View style={styles.chips}>
            {startChoices.map((option) => (
              <Chip
                key={option.label}
                label={option.label}
                selected={(draft.startAt === null && option.daysAhead === null) || (draft.startAt !== null && startChoice === option.daysAhead)}
                onPress={() => {
                  setStartChoice(option.daysAhead);
                  onChange({ startAt: scheduledStartAt(option.daysAhead, new Date()) });
                }}
              />
            ))}
          </View>
          <Text size={12} lineHeight={16} color={colors.textMuted}>Your ad starts once it's approved{draft.startAt ? `, but not before ${new Date(draft.startAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}.</Text>
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  root: { gap: 8 },
  section: { marginTop: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
}));
