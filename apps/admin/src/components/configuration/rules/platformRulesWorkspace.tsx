"use client";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { PageHeader } from "@/components/ui/pageHeader";
import { configurationDocumentEndpoint } from "@/services/configurationApi.service";
import type { CreatorEligibilityRules, UsernameRules } from "@/types/platformConfiguration.type";

import { VersionedDocumentSection } from "../shared/versionedDocumentSection";
import { CreatorEligibilityEditor } from "./creatorEligibilityEditor";
import styles from "./platformRules.module.css";
import { UsernameRulesEditor } from "./usernameRulesEditor";

const creatorEligibilityEndpoint = configurationDocumentEndpoint<"creator-eligibility">();
const usernameRulesEndpoint = configurationDocumentEndpoint<"username-rules">();

export function PlatformRulesWorkspace() {
  const { can } = useAdminPermissions();
  const canWrite = can("config:rules");
  return (
    <>
      <PageHeader area="Configuration" title="Platform rules" description="Who can join the Creator Program and how usernames work. Each set of rules is versioned on its own." />
      <div className={styles.sections}>
        <section aria-labelledby="creator-eligibility-heading">
          <h2 id="creator-eligibility-heading" className={styles.sectionTitle}>Creator Program eligibility</h2>
          <VersionedDocumentSection<CreatorEligibilityRules> endpoint={creatorEligibilityEndpoint} recordId="creator-eligibility" title="Creator eligibility rules" canWrite={canWrite} renderEditor={(content, updateContent, isWritable) => <CreatorEligibilityEditor rules={content} canWrite={isWritable} onChange={updateContent} />} />
        </section>
        <section aria-labelledby="username-rules-heading">
          <h2 id="username-rules-heading" className={styles.sectionTitle}>Usernames</h2>
          <VersionedDocumentSection<UsernameRules> endpoint={usernameRulesEndpoint} recordId="username-rules" title="Username rules" canWrite={canWrite} renderEditor={(content, updateContent, isWritable) => <UsernameRulesEditor rules={content} canWrite={isWritable} onChange={updateContent} />} />
        </section>
      </div>
    </>
  );
}
