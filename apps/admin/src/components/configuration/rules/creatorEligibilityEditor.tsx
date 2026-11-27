import { CheckboxField } from "@/components/ui/formFields";
import type { CreatorEligibilityRules } from "@/types/platformConfiguration.type";

import { WholeNumberField } from "../shared/configurationFields";
import styles from "./platformRules.module.css";

export function CreatorEligibilityEditor({ rules, canWrite, onChange }: { readonly rules: CreatorEligibilityRules; readonly canWrite: boolean; readonly onChange: (updater: (current: CreatorEligibilityRules) => CreatorEligibilityRules) => void }) {
  const isDisabled = !canWrite;
  const setField = <Key extends keyof CreatorEligibilityRules>(key: Key, value: CreatorEligibilityRules[Key]) => onChange((current) => ({ ...current, [key]: value }));
  return (
    <div className={styles.editor}>
      <div className={styles.grid}>
        <WholeNumberField label="Minimum real followers" hint="Cannot be set below 10,000." value={rules.minimumFollowers} minimum={10_000} maximum={100_000_000} isDisabled={isDisabled} onChange={(value) => setField("minimumFollowers", value)} />
        <WholeNumberField label="Minimum verified followers" value={rules.minimumVerifiedFollowers} minimum={500} maximum={100_000_000} isDisabled={isDisabled} onChange={(value) => setField("minimumVerifiedFollowers", value)} />
        <WholeNumberField label="Qualifying impressions in the last 30 days" value={rules.minimumQualifyingImpressionsLast30Days} minimum={100_000} maximum={1_000_000_000} isDisabled={isDisabled} onChange={(value) => setField("minimumQualifyingImpressionsLast30Days", value)} />
        <WholeNumberField label="Original posts in the last 60 days" value={rules.minimumOriginalPostsInLast60Days} minimum={10} maximum={100_000} isDisabled={isDisabled} onChange={(value) => { setField("minimumOriginalPosts", value); setField("minimumOriginalPostsInLast60Days", value); }} />
        <WholeNumberField label="Minimum account age (days)" value={rules.minimumAccountAgeDays} minimum={30} maximum={3650} isDisabled={isDisabled} onChange={(value) => setField("minimumAccountAgeDays", value)} />
        <WholeNumberField label="Clear policy standing (days)" value={rules.noViolationsInDays} minimum={90} maximum={3650} isDisabled={isDisabled} onChange={(value) => setField("noViolationsInDays", value)} />
      </div>
      <div className={styles.checks}>
        <CheckboxField label="Identity verification (KYC) required" description="Needed before creators can receive gift and affiliate payouts." checked={rules.requiresIdentityVerification} disabled={isDisabled} onChange={(event) => setField("requiresIdentityVerification", event.target.checked)} />
      </div>
      <p className={styles.summary}>
        Applicants need at least {rules.minimumFollowers.toLocaleString("en-NG")} real followers, {rules.minimumVerifiedFollowers.toLocaleString("en-NG")} verified followers, {rules.minimumQualifyingImpressionsLast30Days.toLocaleString("en-NG")} qualifying impressions from verified users in the previous 30 days, {rules.minimumOriginalPostsInLast60Days} original posts in the previous 60 days, a verified email, an account at least {rules.minimumAccountAgeDays} days old, and {rules.noViolationsInDays} days of clear standing for auto-approval. Identity verification and payout checks remain separate before earnings can be withdrawn.
      </p>
    </div>
  );
}
