import { CheckboxField } from "@/components/ui/formFields";
import type { CreatorEligibilityRules } from "@/types/platformConfiguration.type";

import { EditableTextList, WholeNumberField } from "../shared/configurationFields";
import styles from "./platformRules.module.css";

export function CreatorEligibilityEditor({ rules, canWrite, onChange }: { readonly rules: CreatorEligibilityRules; readonly canWrite: boolean; readonly onChange: (updater: (current: CreatorEligibilityRules) => CreatorEligibilityRules) => void }) {
  const isDisabled = !canWrite;
  const setField = <Key extends keyof CreatorEligibilityRules>(key: Key, value: CreatorEligibilityRules[Key]) => onChange((current) => ({ ...current, [key]: value }));
  return (
    <div className={styles.editor}>
      <div className={styles.grid}>
        <WholeNumberField label="Minimum followers" value={rules.minimumFollowers} maximum={10_000_000} isDisabled={isDisabled} onChange={(value) => setField("minimumFollowers", value)} />
        <WholeNumberField label="Minimum posts in the last 30 days" value={rules.minimumPostsInLast30Days} maximum={1000} isDisabled={isDisabled} onChange={(value) => setField("minimumPostsInLast30Days", value)} />
        <WholeNumberField label="Maximum active strikes" value={rules.maximumActiveStrikes} maximum={10} isDisabled={isDisabled} onChange={(value) => setField("maximumActiveStrikes", value)} />
        <WholeNumberField label="Minimum account age (days)" value={rules.minimumAccountAgeDays} maximum={3650} isDisabled={isDisabled} onChange={(value) => setField("minimumAccountAgeDays", value)} />
      </div>
      <div className={styles.checks}>
        <CheckboxField label="Identity verification (KYC) required" description="Needed before creators can receive gift and affiliate payouts." checked={rules.requiresIdentityVerification} disabled={isDisabled} onChange={(event) => setField("requiresIdentityVerification", event.target.checked)} />
      </div>
      <EditableTextList label="Countries where people can apply" items={rules.allowedCountries} placeholder="Two-letter code, e.g. NG" maximumLength={2} isDisabled={isDisabled} onChange={(countries) => setField("allowedCountries", countries.map((country) => country.toUpperCase().replace(/[^A-Z]/g, "")))} />
      <p className={styles.summary}>
        Applicants need {rules.minimumFollowers.toLocaleString("en-NG")}+ followers, {rules.minimumPostsInLast30Days}+ posts this month, at most {rules.maximumActiveStrikes} active strikes and an account at least {rules.minimumAccountAgeDays} days old. Going live stays limited to approved Creator Program members.
      </p>
    </div>
  );
}
