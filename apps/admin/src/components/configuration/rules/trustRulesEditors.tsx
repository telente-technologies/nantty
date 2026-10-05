import { CheckboxField, SelectField } from "@/components/ui/formFields";
import type { CheckmarkPricingRules, CheckmarkSuggestionRules, CreatorProgramThresholds, TrialLength, TrialRules } from "@/types/platformConfiguration.type";

import { WholeNumberField } from "../shared/configurationFields";
import styles from "./platformRules.module.css";

interface EditorProps<Rules> {
  readonly rules: Rules;
  readonly canWrite: boolean;
  readonly onChange: (updater: (current: Rules) => Rules) => void;
}

export function CheckmarkSuggestionEditor({ rules, canWrite, onChange }: EditorProps<CheckmarkSuggestionRules>) {
  const disabled = !canWrite;
  const setBlue = <Key extends keyof CheckmarkSuggestionRules["blue"]>(key: Key, value: CheckmarkSuggestionRules["blue"][Key]) => onChange((current) => ({ ...current, blue: { ...current.blue, [key]: value } }));
  const setGold = <Key extends keyof CheckmarkSuggestionRules["gold"]>(key: Key, value: CheckmarkSuggestionRules["gold"][Key]) => onChange((current) => ({ ...current, gold: { ...current.gold, [key]: value } }));
  return (
    <div className={styles.editor}>
      <h3 className={styles.sectionTitle}>Blue (personal, incl. creators)</h3>
      <div className={styles.grid}>
        <WholeNumberField label="Minimum account age (days)" value={rules.blue.minimumAccountAgeDays} maximum={3650} isDisabled={disabled} onChange={(value) => setBlue("minimumAccountAgeDays", value)} />
        <WholeNumberField label="Minimum real followers" value={rules.blue.minimumRealFollowers} maximum={10_000_000} isDisabled={disabled} onChange={(value) => setBlue("minimumRealFollowers", value)} />
        <WholeNumberField label="No violations in the last (days)" value={rules.blue.noViolationsInDays} maximum={730} isDisabled={disabled} onChange={(value) => setBlue("noViolationsInDays", value)} />
      </div>
      <div className={styles.checks}>
        <CheckboxField label="ID verified" checked={rules.blue.requiresIdVerified} disabled={disabled} onChange={(event) => setBlue("requiresIdVerified", event.target.checked)} />
      </div>
      <h3 className={styles.sectionTitle}>Gold (business)</h3>
      <div className={styles.grid}>
        <WholeNumberField label="Minimum completed orders" value={rules.gold.minimumCompletedOrders} maximum={100_000} isDisabled={disabled} onChange={(value) => setGold("minimumCompletedOrders", value)} />
        <WholeNumberField label="Minimum success rate (%)" value={rules.gold.minimumSuccessRatePercent} maximum={100} isDisabled={disabled} onChange={(value) => setGold("minimumSuccessRatePercent", value)} />
      </div>
      <div className={styles.checks}>
        <CheckboxField label="Business verification (CAC/KYB) passed" checked={rules.gold.requiresBusinessVerification} disabled={disabled} onChange={(event) => setGold("requiresBusinessVerification", event.target.checked)} />
        <CheckboxField label="Active store or brand page" checked={rules.gold.requiresActiveStoreOrBrandPage} disabled={disabled} onChange={(event) => setGold("requiresActiveStoreOrBrandPage", event.target.checked)} />
      </div>
      <p className={styles.summary}>Gold needs at least {rules.gold.minimumCompletedOrders} orders and {rules.gold.minimumSuccessRatePercent}% success. Suggestions are rule-based and only nudge the person to apply. Black is never suggested. It is granted by an admin only.</p>
    </div>
  );
}

export function CreatorThresholdsEditor({ rules, canWrite, onChange }: EditorProps<CreatorProgramThresholds>) {
  const disabled = !canWrite;
  const setAuto = <Key extends keyof CreatorProgramThresholds["autoApprove"]>(key: Key, value: CreatorProgramThresholds["autoApprove"][Key]) => onChange((current) => ({ ...current, autoApprove: { ...current.autoApprove, [key]: value } }));
  const setManual = <Key extends keyof CreatorProgramThresholds["manualReview"]>(key: Key, value: CreatorProgramThresholds["manualReview"][Key]) => onChange((current) => ({ ...current, manualReview: { ...current.manualReview, [key]: value } }));
  return (
    <div className={styles.editor}>
      <h3 className={styles.sectionTitle}>Auto-approve when all of these are met</h3>
      <div className={styles.grid}>
        <WholeNumberField label="Minimum account age (days)" value={rules.autoApprove.minimumAccountAgeDays} maximum={3650} isDisabled={disabled} onChange={(value) => setAuto("minimumAccountAgeDays", value)} />
        <WholeNumberField label="Minimum real followers" value={rules.autoApprove.minimumRealFollowers} maximum={10_000_000} isDisabled={disabled} onChange={(value) => setAuto("minimumRealFollowers", value)} />
        <WholeNumberField label="Original posts in the last 60 days" value={rules.autoApprove.minimumOriginalPostsInLast60Days} maximum={1000} isDisabled={disabled} onChange={(value) => setAuto("minimumOriginalPostsInLast60Days", value)} />
        <WholeNumberField label="No violations in the last (days)" value={rules.autoApprove.noViolationsInDays} maximum={730} isDisabled={disabled} onChange={(value) => setAuto("noViolationsInDays", value)} />
        <WholeNumberField label="Maximum fraud score (0-100, low)" value={rules.autoApprove.maximumFraudScore} maximum={100} isDisabled={disabled} onChange={(value) => setAuto("maximumFraudScore", value)} />
      </div>
      <div className={styles.checks}>
        <CheckboxField label="Verified email" checked={rules.autoApprove.requiresVerifiedEmail} disabled={disabled} onChange={(event) => setAuto("requiresVerifiedEmail", event.target.checked)} />
      </div>
      <h3 className={styles.sectionTitle}>Manual review covers</h3>
      <div className={styles.grid}>
        <WholeNumberField label="Minimum real followers" hint="Below this is not eligible." value={rules.manualReview.minimumRealFollowers} maximum={10_000_000} isDisabled={disabled} onChange={(value) => setManual("minimumRealFollowers", value)} />
        <WholeNumberField label="Maximum risk score (medium)" value={rules.manualReview.maximumRiskScore} maximum={100} isDisabled={disabled} onChange={(value) => setManual("maximumRiskScore", value)} />
      </div>
      <div className={styles.checks}>
        <CheckboxField label="A past violation" checked={rules.manualReview.allowsPastViolation} disabled={disabled} onChange={(event) => setManual("allowsPastViolation", event.target.checked)} />
        <CheckboxField label="Borderline or AI-heavy content" checked={rules.manualReview.allowsBorderlineOrAiHeavyContent} disabled={disabled} onChange={(event) => setManual("allowsBorderlineOrAiHeavyContent", event.target.checked)} />
      </div>
      <p className={styles.summary}>With {rules.autoApprove.minimumRealFollowers.toLocaleString("en-NG")}+ real followers and everything above met, creators are approved automatically. {rules.manualReview.minimumRealFollowers}-{rules.autoApprove.minimumRealFollowers - 1} followers, a past violation, borderline content or medium risk goes to manual review. Anyone below sees "not eligible yet" with a progress checklist.</p>
    </div>
  );
}

const trialLengthOptions = [{ value: "DAYS_7", label: "7 days" }, { value: "MONTH_1", label: "1 month" }];

export function TrialRulesEditor({ rules, canWrite, onChange }: EditorProps<TrialRules>) {
  const disabled = !canWrite;
  const set = <Key extends keyof TrialRules>(key: Key, value: TrialRules[Key]) => onChange((current) => ({ ...current, [key]: value }));
  const toggles: readonly { key: "requiresVerifiedEmail" | "onePerPerson" | "onePerCard" | "onePerDevice"; label: string }[] = [
    { key: "requiresVerifiedEmail", label: "Verified email required" }, { key: "onePerPerson", label: "One trial per person" }, { key: "onePerCard", label: "One trial per card" }, { key: "onePerDevice", label: "One trial per device" },
  ];
  return (
    <div className={styles.editor}>
      <div className={styles.grid}>
        <SelectField label="Trial length" value={rules.trialLength} disabled={disabled} options={trialLengthOptions} onChange={(event) => set("trialLength", event.target.value as TrialLength)} />
        <WholeNumberField label="Yearly discount (%)" hint="Admin-editable. Default 20%." value={rules.yearlyDiscountPercent} maximum={60} isDisabled={disabled} onChange={(value) => set("yearlyDiscountPercent", value)} />
        <WholeNumberField label="Minimum account age (days)" value={rules.minimumAccountAgeDays} maximum={3650} isDisabled={disabled} onChange={(value) => set("minimumAccountAgeDays", value)} />
        <WholeNumberField label="Maximum risk score (0-100)" value={rules.maximumRiskScore} maximum={100} isDisabled={disabled} onChange={(value) => set("maximumRiskScore", value)} />
        <WholeNumberField label="Completed store orders needed" hint="0 means no orders needed." value={rules.minimumCompletedOrders} maximum={100_000} isDisabled={disabled} onChange={(value) => set("minimumCompletedOrders", value)} />
      </div>
      <div className={styles.checks}>
        {toggles.map((toggle) => <CheckboxField key={toggle.key} label={toggle.label} checked={rules[toggle.key]} disabled={disabled} onChange={(event) => set(toggle.key, event.target.checked)} />)}
      </div>
      <p className={styles.summary}>Trials need a card saved on the web through Paystack. A small verification charge is made and refunded automatically. Risk scores come from the intelligence service.</p>
    </div>
  );
}

export function CheckmarkPricingEditor({ rules, canWrite, onChange }: EditorProps<CheckmarkPricingRules>) {
  const disabled = !canWrite;
  return (
    <div className={styles.editor}>
      <div className={styles.grid}>
        <WholeNumberField label="Blue + Gold bundle discount (%)" value={rules.bundleDiscountPercent} maximum={50} isDisabled={disabled} onChange={(value) => onChange((current) => ({ ...current, bundleDiscountPercent: value }))} />
        <WholeNumberField label="Bundle cap (businesses per person)" value={rules.bundleMaximumBusinesses} minimum={1} maximum={20} isDisabled={disabled} onChange={(value) => onChange((current) => ({ ...current, bundleMaximumBusinesses: value }))} />
        <WholeNumberField label="Black grace period (days)" value={rules.blackGraceDays} maximum={90} isDisabled={disabled} onChange={(value) => onChange((current) => ({ ...current, blackGraceDays: value }))} />
      </div>
      <p className={styles.summary}>The bundle never stacks with the yearly discount: the bigger one wins. It never applies to Black and lapses at the next renewal if Blue ends. Blue and Gold drop at period end. Black keeps its badge for {rules.blackGraceDays} days with reminders before it is removed. Prices for every plan and region are set in <a href="/config/pricing">Regional pricing</a>.</p>
    </div>
  );
}
