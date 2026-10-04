import type { WizardFieldChanges } from "@/components/campaignWizard/campaignWizardState.store";
import type { WizardStepProps } from "@/components/campaignWizard/wizardStepProps.type";
import { CheckboxField, SegmentedControl, SelectField, TextField } from "@/components/ui/formFields";
import { bidStrategyOptions } from "@/constants/campaignOptions.constant";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { billingApi } from "@/services/billingApi.service";
import { CampaignCostEstimatePanel } from "@/components/campaignWizard/campaignCostEstimatePanel";
import { toolsApi } from "@/services/toolsApi.service";
import type { BidStrategyType, BudgetType } from "@/types/campaign.type";
import { formatMoneyForDisplay, parseTypedMajorAmountToMoney, readCurrencySymbol } from "@/utils/money.util";

import styles from "./wizardSteps.module.css";

const budgetTypeOptions: readonly { readonly value: BudgetType; readonly label: string }[] = [
  { value: "daily", label: "Daily budget" },
  { value: "lifetime", label: "Lifetime budget" },
];

export function BudgetScheduleStep({ state, dispatch, errors, currency, accountId }: WizardStepProps) {
  const updateFields = (changes: WizardFieldChanges) => dispatch({ type: "update_fields", changes });
  const currencySymbol = readCurrencySymbol(currency);
  const conversionEventsQuery = useAdsQuery(() => toolsApi.listConversionEvents(accountId), `conversion-events-${accountId}`, state.objective === "sales");
  const conversionEventOptions = [{ value: "", label: "Purchase (default for your store)" }, ...(conversionEventsQuery.data?.items ?? []).filter((event) => event.status !== "paused").map((event) => ({ value: event.id, label: `${event.name} · ${event.storeName}` }))];
  const selectedBidOption = bidStrategyOptions.find((option) => option.type === state.bidType);
  const targetedCountryCodes = [...new Set(state.audience.locations.map((location) => location.countryCode).filter(Boolean))].sort();
  const regionalPricingQuery = useAdsQuery(() => billingApi.fetchRegionalPricing(targetedCountryCodes, currency), `ads-pricing-${currency}-${targetedCountryCodes.join(",")}`);
  const minimumDailyBudget = regionalPricingQuery.data?.minimumDailyBudget;
  const dailyBudgetHint = `Average spend per day. Some days may spend up to 25% more, balanced over the week.${minimumDailyBudget ? ` The minimum for the regions you target is ${formatMoneyForDisplay(minimumDailyBudget)}.` : ""}`;
  return (
    <div className={styles.stepBody}>
      <h2 className={styles.stepHeading}>Budget and schedule</h2>
      <p className={styles.stepIntro}>{state.budgetLevel === "campaign" ? "This budget is shared by every ad set in the campaign." : "This budget belongs to this ad set only."} Amounts are in {currency}, the ad account currency.</p>
      <div className={styles.inlineFields}>
        <SegmentedControl label="Budget type" value={state.budgetType} options={budgetTypeOptions} onValueChange={(budgetType) => updateFields({ budgetType })} />
      </div>
      <TextField label={state.budgetType === "daily" ? "Daily budget" : "Lifetime budget"} prefix={currencySymbol} inputMode="decimal" value={state.budgetAmountText} onValueChange={(budgetAmountText) => updateFields({ budgetAmountText })} error={errors.budgetAmount} hint={state.budgetType === "daily" ? dailyBudgetHint : "Total spend spread across the schedule."} fieldClassName={styles.narrowField} />
      <div className={styles.twoColumnFields}>
        <TextField label="Start" type="datetime-local" value={state.startAtLocal} onValueChange={(startAtLocal) => updateFields({ startAtLocal })} error={errors.startAt} />
        <TextField label={state.budgetType === "lifetime" ? "End" : "End (optional)"} type="datetime-local" value={state.endAtLocal} onValueChange={(endAtLocal) => updateFields({ endAtLocal })} error={errors.endAt} hint={state.budgetType === "daily" ? "Leave empty to run until you pause it." : undefined} />
      </div>
      <CampaignCostEstimatePanel
        countryCodes={targetedCountryCodes}
        currency={currency}
        budgetType={state.budgetType}
        budgetAmountMinor={parseTypedMajorAmountToMoney(state.budgetAmountText, currency)?.amountMinor ?? null}
        startAtLocal={state.startAtLocal}
        endAtLocal={state.endAtLocal}
        objective={state.objective}
      />
      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldLegend}>Bid strategy</legend>
        <div className={styles.bidGrid}>
          {bidStrategyOptions.map((option) => (
            <label key={option.type} className={state.bidType === option.type ? `${styles.choiceCard} ${styles.choiceCardSelected}` : styles.choiceCard}>
              <input type="radio" name="bidStrategy" className={styles.choiceRadio} checked={state.bidType === option.type} onChange={() => updateFields({ bidType: option.type as BidStrategyType })} />
              <span className={styles.choiceTitle}>{option.label}</span>
              <span className={styles.choiceDescription}>{option.description}</span>
            </label>
          ))}
        </div>
        {selectedBidOption?.needsAmount ? <TextField label={selectedBidOption.label} prefix={currencySymbol} inputMode="decimal" value={state.bidAmountText} onValueChange={(bidAmountText) => updateFields({ bidAmountText })} error={errors.bidAmount} hint="Your ad competes in an auction ranked by bid and ad quality. You often pay less than your maximum." fieldClassName={styles.narrowField} /> : null}
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldLegend}>Frequency cap</legend>
        <CheckboxField label="Limit how often one person sees these ads" checked={state.isFrequencyCapEnabled} onCheckedChange={(isFrequencyCapEnabled) => updateFields({ isFrequencyCapEnabled })} />
        {state.isFrequencyCapEnabled ? (
          <div className={styles.inlineFields}>
            <TextField label="Impressions" inputMode="numeric" value={state.frequencyImpressionsText} onValueChange={(frequencyImpressionsText) => updateFields({ frequencyImpressionsText })} fieldClassName={styles.tinyField} />
            <span className={styles.inlineWord}>every</span>
            <TextField label="Days" inputMode="numeric" value={state.frequencyPerDaysText} onValueChange={(frequencyPerDaysText) => updateFields({ frequencyPerDaysText })} fieldClassName={styles.tinyField} />
          </div>
        ) : null}
        {errors.frequencyCap ? (
          <p className={styles.error} role="alert">
            {errors.frequencyCap}
          </p>
        ) : null}
      </fieldset>
      {state.objective === "sales" ? (
        <SelectField label="Conversion event" value={state.conversionEventId} options={conversionEventOptions} onValueChange={(conversionEventId) => updateFields({ conversionEventId })} hint="Orders in your Zudomart store are attributed automatically — no pixel needed." fieldClassName={styles.narrowField} />
      ) : null}
    </div>
  );
}
