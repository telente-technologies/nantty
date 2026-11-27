import { CheckboxField, SelectField } from "@/components/ui/formFields";
import type { CheckmarkPricingRules, CheckmarkSuggestionRules, CreatorProgramThresholds, MultiBusinessYearlyMode, TrialLength, TrialRules } from "@/types/platformConfiguration.type";

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
        <WholeNumberField label="Minimum account age (days)" value={rules.autoApprove.minimumAccountAgeDays} minimum={30} maximum={3650} isDisabled={disabled} onChange={(value) => setAuto("minimumAccountAgeDays", value)} />
        <WholeNumberField label="Minimum real followers" hint="Cannot be set below 10,000." value={rules.autoApprove.minimumRealFollowers} maximum={100_000_000} isDisabled={disabled} onChange={(value) => setAuto("minimumRealFollowers", value)} />
        <WholeNumberField label="Minimum verified followers" hint="Cannot be set below 500." value={rules.autoApprove.minimumVerifiedFollowers} maximum={100_000_000} isDisabled={disabled} onChange={(value) => setAuto("minimumVerifiedFollowers", value)} />
        <WholeNumberField label="Qualifying impressions in the last 30 days" hint="Verified-user impressions after invalid-traffic filtering. Minimum 100,000." value={rules.autoApprove.minimumQualifyingImpressionsLast30Days} maximum={1_000_000_000} isDisabled={disabled} onChange={(value) => setAuto("minimumQualifyingImpressionsLast30Days", value)} />
        <WholeNumberField label="Original posts in the last 60 days" value={rules.autoApprove.minimumOriginalPostsInLast60Days} minimum={10} maximum={100_000} isDisabled={disabled} onChange={(value) => setAuto("minimumOriginalPostsInLast60Days", value)} />
        <WholeNumberField label="No violations in the last (days)" value={rules.autoApprove.noViolationsInDays} minimum={90} maximum={3650} isDisabled={disabled} onChange={(value) => setAuto("noViolationsInDays", value)} />
        <WholeNumberField label="Maximum fraud score (0-100, low)" value={rules.autoApprove.maximumFraudScore} maximum={100} isDisabled={disabled} onChange={(value) => setAuto("maximumFraudScore", value)} />
      </div>
      <div className={styles.checks}>
        <CheckboxField label="Verified email is mandatory" checked={true} disabled={true} onChange={() => undefined} />
        <CheckboxField label="Identity verification required for automatic approval" description="If the identity check is unavailable or incomplete, qualifying applications go to manual review. Identity and payout verification remain mandatory before cash-out." checked={rules.autoApprove.requiresIdentityVerification ?? false} disabled={disabled} onChange={(event) => setAuto("requiresIdentityVerification", event.target.checked)} />
      </div>
      <h3 className={styles.sectionTitle}>Manual review covers</h3>
      <div className={styles.grid}>
        <WholeNumberField label="Maximum risk score (medium)" value={rules.manualReview.maximumRiskScore} maximum={100} isDisabled={disabled} onChange={(value) => setManual("maximumRiskScore", value)} />
      </div>
      <div className={styles.checks}>
        <CheckboxField label="A past violation" checked={rules.manualReview.allowsPastViolation} disabled={disabled} onChange={(event) => setManual("allowsPastViolation", event.target.checked)} />
        <CheckboxField label="Borderline or AI-heavy content" checked={rules.manualReview.allowsBorderlineOrAiHeavyContent} disabled={disabled} onChange={(event) => setManual("allowsBorderlineOrAiHeavyContent", event.target.checked)} />
      </div>
      <p className={styles.summary}>Every applicant must meet the account, original-content, 30-day qualifying-impression, 10,000 real-follower and 500 verified-follower minimums. Applicants who meet those gates but need a standing or risk review are sent to staff; only clean cases meeting every auto-approval rule can be approved automatically. Lowering these minimums is not permitted.</p>
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
      <p className={styles.summary}>Trials need a card saved on the web through the payment partner&apos;s checkout. A small verification charge is made and refunded automatically. Risk scores come from the intelligence service.</p>
    </div>
  );
}

const multiBusinessYearlyModeOptions = [{ value: "replace", label: "Replace the normal yearly discount" }, { value: "add", label: "Add to the normal yearly discount" }];

export function CheckmarkPricingEditor({ rules, canWrite, onChange }: EditorProps<CheckmarkPricingRules>) {
  const disabled = !canWrite;
  const set = <Key extends keyof CheckmarkPricingRules>(key: Key, value: CheckmarkPricingRules[Key]) => onChange((current) => ({ ...current, [key]: value }));
  const singleProfilePercent = rules.multiBusinessSingleProfilePercent ?? 5;
  const basePercent = rules.multiBusinessBasePercent ?? 10;
  const stepPercent = rules.multiBusinessStepPercent ?? 2;
  const maximumProfiles = rules.multiBusinessMaximumProfiles ?? 5;
  const yearlyExtraPercent = rules.multiBusinessYearlyExtraPercent ?? 5;
  const yearlyMode = rules.multiBusinessYearlyMode ?? "replace";
  const largestDiscountPercent = maximumProfiles < 2 ? singleProfilePercent : basePercent + stepPercent * (maximumProfiles - 2);
  return (
    <div className={styles.editor}>
      <div className={styles.grid}>
        <WholeNumberField label="Blue + Gold bundle discount (%)" value={rules.bundleDiscountPercent} maximum={50} isDisabled={disabled} onChange={(value) => onChange((current) => ({ ...current, bundleDiscountPercent: value }))} />
        <WholeNumberField label="Bundle cap (businesses per person)" value={rules.bundleMaximumBusinesses} minimum={1} maximum={20} isDisabled={disabled} onChange={(value) => onChange((current) => ({ ...current, bundleMaximumBusinesses: value }))} />
        <WholeNumberField label="Black grace period (days)" value={rules.blackGraceDays} maximum={90} isDisabled={disabled} onChange={(value) => onChange((current) => ({ ...current, blackGraceDays: value }))} />
      </div>
      <h3 className={styles.sectionTitle}>Gold for all your businesses (Premium)</h3>
      <div className={styles.grid}>
        <WholeNumberField label="1 profile discount (%)" value={singleProfilePercent} maximum={90} isDisabled={disabled} onChange={(value) => set("multiBusinessSingleProfilePercent", value)} />
        <WholeNumberField label="2 profiles discount (%)" hint="The base discount." value={basePercent} maximum={90} isDisabled={disabled} onChange={(value) => set("multiBusinessBasePercent", value)} />
        <WholeNumberField label="Extra per profile after 2 (%)" value={stepPercent} maximum={90} isDisabled={disabled} onChange={(value) => set("multiBusinessStepPercent", value)} />
        <WholeNumberField label="Most profiles on one plan" value={maximumProfiles} minimum={1} maximum={5} isDisabled={disabled} onChange={(value) => set("multiBusinessMaximumProfiles", value)} />
        <WholeNumberField label="Extra yearly discount (%)" value={yearlyExtraPercent} maximum={90} isDisabled={disabled} onChange={(value) => set("multiBusinessYearlyExtraPercent", value)} />
        <SelectField label="Yearly discount" value={yearlyMode} disabled={disabled} options={multiBusinessYearlyModeOptions} onChange={(event) => set("multiBusinessYearlyMode", event.target.value as MultiBusinessYearlyMode)} />
      </div>
      <p className={styles.summary}>One Gold plan covering up to {maximumProfiles} business or brand profiles, for Blue Premium only. The biggest discount is {largestDiscountPercent}% and must stay at or below 90%. Yearly plans get {yearlyExtraPercent}% more off, {yearlyMode === "replace" ? "instead of" : "on top of"} the normal yearly discount. It never stacks with offer links or the Blue + Gold bundle: the best single discount wins.</p>
      <p className={styles.summary}>The bundle never stacks with the yearly discount: the bigger one wins. It never applies to Black and lapses at the next renewal if Blue ends. Blue and Gold drop at period end. Black keeps its badge for {rules.blackGraceDays} days with reminders before it is removed. Prices for every plan and region are set in <a href="/config/pricing">Regional pricing</a>.</p>
    </div>
  );
}
