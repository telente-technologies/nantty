import type { WizardFieldChanges } from "@/components/campaignWizard/campaignWizardState.store";
import type { WizardStepProps } from "@/components/campaignWizard/wizardStepProps.type";
import { TextField } from "@/components/ui/formFields";
import { campaignNameMaximumLength } from "@/constants/campaignOptions.constant";
import { readCurrencySymbol } from "@/utils/money.util";

import styles from "./wizardSteps.module.css";

export function CampaignSettingsStep({ state, dispatch, errors, currency }: WizardStepProps) {
  const updateFields = (changes: WizardFieldChanges) => dispatch({ type: "update_fields", changes });
  return (
    <div className={styles.stepBody}>
      <h2 className={styles.stepHeading}>Campaign details</h2>
      <TextField label="Campaign name" value={state.campaignName} onValueChange={(campaignName) => updateFields({ campaignName })} maxLength={campaignNameMaximumLength} error={errors.campaignName} hint="Only you and your team see this name." />
      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldLegend}>Where should the budget live?</legend>
        <div className={styles.twoColumnChoices}>
          <label className={state.budgetLevel === "campaign" ? `${styles.choiceCard} ${styles.choiceCardSelected}` : styles.choiceCard}>
            <input type="radio" name="budgetLevel" className={styles.choiceRadio} checked={state.budgetLevel === "campaign"} onChange={() => updateFields({ budgetLevel: "campaign" })} />
            <span className={styles.choiceTitle}>Campaign budget (recommended)</span>
            <span className={styles.choiceDescription}>One budget shared across ad sets. Spend moves automatically to the ad sets getting the best results.</span>
          </label>
          <label className={state.budgetLevel === "ad_set" ? `${styles.choiceCard} ${styles.choiceCardSelected}` : styles.choiceCard}>
            <input type="radio" name="budgetLevel" className={styles.choiceRadio} checked={state.budgetLevel === "ad_set"} onChange={() => updateFields({ budgetLevel: "ad_set" })} />
            <span className={styles.choiceTitle}>Ad set budgets</span>
            <span className={styles.choiceDescription}>Each ad set gets its own fixed budget. Useful when you want exact control, such as in A/B tests.</span>
          </label>
        </div>
      </fieldset>
      <TextField
        label="Campaign spend cap (optional)"
        prefix={readCurrencySymbol(currency)}
        inputMode="decimal"
        value={state.spendCapText}
        onValueChange={(spendCapText) => updateFields({ spendCapText })}
        error={errors.spendCap}
        hint={`The campaign stops once it has spent this much in total, in ${currency}.`}
        fieldClassName={styles.narrowField}
      />
    </div>
  );
}
