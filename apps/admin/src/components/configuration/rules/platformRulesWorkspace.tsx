"use client";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { PageHeader } from "@/components/ui/pageHeader";
import { configurationDocumentEndpoint } from "@/services/configurationApi.service";
import type { CheckmarkPricingRules, CheckmarkSuggestionRules, CreatorProgramThresholds, TrialRules, UsernameRules } from "@/types/platformConfiguration.type";

import { VersionedDocumentSection } from "../shared/versionedDocumentSection";
import styles from "./platformRules.module.css";
import { RetentionPoliciesSection } from "./retentionPoliciesSection";
import { CheckmarkPricingEditor, CheckmarkSuggestionEditor, CreatorThresholdsEditor, TrialRulesEditor } from "./trustRulesEditors";
import { UsernameRulesEditor } from "./usernameRulesEditor";

const usernameRulesEndpoint = configurationDocumentEndpoint<"username-rules">();
const checkmarkEndpoint = configurationDocumentEndpoint<"checkmark-suggestions">();
const creatorThresholdsEndpoint = configurationDocumentEndpoint<"creator-thresholds">();
const trialRulesEndpoint = configurationDocumentEndpoint<"trial-rules">();
const pricingEndpoint = configurationDocumentEndpoint<"checkmark-pricing">();

export function PlatformRulesWorkspace() {
  const { can } = useAdminPermissions();
  const canWrite = can("config:rules");
  return (
    <>
      <PageHeader area="Configuration" title="Platform rules" description="Checkmark suggestions, Creator Program thresholds, trials and usernames. Each set of rules is versioned on its own." />
      <div className={styles.sections}>
        <section aria-labelledby="checkmark-heading">
          <h2 id="checkmark-heading" className={styles.sectionTitle}>Checkmark suggestions</h2>
          <VersionedDocumentSection<CheckmarkSuggestionRules> endpoint={checkmarkEndpoint} recordId="checkmark-suggestions" title="Checkmark suggestion thresholds" canWrite={canWrite} renderEditor={(content, updateContent, isWritable) => <CheckmarkSuggestionEditor rules={content} canWrite={isWritable} onChange={updateContent} />} />
        </section>
        <section aria-labelledby="creator-thresholds-heading">
          <h2 id="creator-thresholds-heading" className={styles.sectionTitle}>Creator Program auto-approve and review</h2>
          <VersionedDocumentSection<CreatorProgramThresholds> endpoint={creatorThresholdsEndpoint} recordId="creator-thresholds" title="Creator Program thresholds" canWrite={canWrite} renderEditor={(content, updateContent, isWritable) => <CreatorThresholdsEditor rules={content} canWrite={isWritable} onChange={updateContent} />} />
        </section>
        <section aria-labelledby="trial-rules-heading">
          <h2 id="trial-rules-heading" className={styles.sectionTitle}>Free trials and yearly discount</h2>
          <VersionedDocumentSection<TrialRules> endpoint={trialRulesEndpoint} recordId="trial-rules" title="Trial rules" canWrite={canWrite} renderEditor={(content, updateContent, isWritable) => <TrialRulesEditor rules={content} canWrite={isWritable} onChange={updateContent} />} />
        </section>
        <section aria-labelledby="pricing-heading">
          <h2 id="pricing-heading" className={styles.sectionTitle}>Gold-only, Black and bundle pricing</h2>
          <VersionedDocumentSection<CheckmarkPricingRules> endpoint={pricingEndpoint} recordId="checkmark-pricing" title="Checkmark pricing" canWrite={can("config:plans")} renderEditor={(content, updateContent, isWritable) => <CheckmarkPricingEditor rules={content} canWrite={isWritable} onChange={updateContent} />} />
        </section>
        <section aria-labelledby="username-rules-heading">
          <h2 id="username-rules-heading" className={styles.sectionTitle}>Usernames</h2>
          <VersionedDocumentSection<UsernameRules> endpoint={usernameRulesEndpoint} recordId="username-rules" title="Username rules" canWrite={canWrite} renderEditor={(content, updateContent, isWritable) => <UsernameRulesEditor rules={content} canWrite={isWritable} onChange={updateContent} />} />
        </section>
        <section aria-labelledby="retention-policies-heading">
          <h2 id="retention-policies-heading" className={styles.sectionTitle}>Data retention policies</h2>
          <RetentionPoliciesSection canWrite={canWrite} />
        </section>
      </div>
    </>
  );
}
