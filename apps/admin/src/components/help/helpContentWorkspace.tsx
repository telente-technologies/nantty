"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/formFields";
import { InlineError } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { Card } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchHelpSettings, updateHelpSettings } from "@/services/helpContentApi.service";

import { AutoTopicsPanel } from "./autoTopicsPanel";
import { HelpCategoriesPanel } from "./helpCategoriesPanel";
import styles from "./helpContent.module.css";
import { HelpTopicsPanel } from "./helpTopicsPanel";

type WorkspaceTab = "topics" | "auto" | "categories";

const tabs: readonly { readonly key: WorkspaceTab; readonly label: string }[] = [
  { key: "topics", label: "Topics" },
  { key: "auto", label: "From resolved tickets" },
  { key: "categories", label: "Categories" },
];

function AutoPublishSetting({ canEdit }: { readonly canEdit: boolean }) {
  const { showToast } = useToast();
  const settings = useAdminQuery((signal) => fetchHelpSettings(signal), "help-settings");
  const save = useAdminMutation(updateHelpSettings);
  const requiresReview = settings.data?.autoFaqRequiresReview ?? false;

  async function toggle(next: boolean) {
    const saved = await save.run({ autoFaqRequiresReview: next });
    if (!saved) return;
    settings.replaceData(() => saved);
    showToast(saved.autoFaqRequiresReview ? "New topics from tickets now wait for review" : "New topics from tickets now publish automatically");
  }

  return (
    <Card title="Topics from resolved tickets" className={styles.settingsCard}>
      <div className={styles.stack}>
        <p className={styles.muted}>When a ticket is resolved with a staff answer, personal details are removed and the question becomes a help topic, or a related question on a close existing topic. Safety tickets are never used.</p>
        <CheckboxField
          label="Require an admin to review new topics before they are published"
          description="Off means topics publish automatically, marked From a resolved question."
          checked={requiresReview}
          disabled={!canEdit || !settings.data || save.isRunning}
          onChange={(event) => void toggle(event.target.checked)}
        />
        {save.errorMessage ? <InlineError message={save.errorMessage} /> : null}
      </div>
    </Card>
  );
}

export function HelpContentWorkspace() {
  const router = useRouter();
  const { can } = useAdminPermissions();
  const canEdit = can("support:helpContent");
  const [tab, setTab] = useState<WorkspaceTab>("topics");
  return (
    <>
      <PageHeader
        area="Support"
        title="Help centre"
        description="Every article people read in the Help Centre on the app and the web. Guests can read published topics."
        actions={canEdit ? <Button variant="primary" onClick={() => router.push("/support/help/new")}>New topic</Button> : null}
      />
      <AutoPublishSetting canEdit={canEdit} />
      <SegmentedTabs label="Help centre sections" items={tabs} activeKey={tab} onChange={setTab} />
      {tab === "topics" ? <HelpTopicsPanel /> : tab === "auto" ? <AutoTopicsPanel /> : <HelpCategoriesPanel canEdit={canEdit} />}
    </>
  );
}
