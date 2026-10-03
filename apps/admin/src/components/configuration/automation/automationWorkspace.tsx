"use client";

import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { automationRulesEndpoint, fetchAutomationCatalog, fetchAutomationExecutions, fetchAutomationSampleEvents, fetchVersionedRecords } from "@/services/configurationApi.service";
import type { AutomationRuleContent } from "@/types/automation.type";
import type { VersionedRecord } from "@/types/platformConfiguration.type";

import { VersionedRecordPanel } from "../shared/versionedRecordPanel";
import styles from "./automation.module.css";
import { AutomationDryRunPreview } from "./automationDryRunPreview";
import { AutomationExecutionLog } from "./automationExecutionLog";
import { AutomationRuleEditor, findAutomationRuleDraftProblem } from "./automationRuleEditor";

type RuleRecord = VersionedRecord<AutomationRuleContent>;

function buildRuleIdentifierFromName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);
  return `rule_${slug || "untitled"}`;
}

export function AutomationWorkspace() {
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const canWrite = can("automation:manage");
  const catalog = useAdminQuery((signal) => fetchAutomationCatalog(signal), "automation-catalog");
  const samples = useAdminQuery((signal) => fetchAutomationSampleEvents(signal), "automation-samples");
  const rules = useAdminQuery((signal) => fetchVersionedRecords(automationRulesEndpoint, signal), "automation-rules");
  const executions = useAdminQuery((signal) => fetchAutomationExecutions(null, signal), "automation-executions");
  const [openRule, setOpenRule] = useState<RuleRecord | "new" | null>(null);

  const eventLabel = (key: string) => catalog.data?.events.find((definition) => definition.key === key)?.label ?? key;
  const blankRule: AutomationRuleContent = { name: "", description: "", isEnabled: false, event: catalog.data?.events[0]?.key ?? "order.delivered", conditionMatch: "ALL", conditions: [], actions: [] };

  return (
    <>
      <PageHeader
        area="Configuration"
        title="Automation"
        description="Rules that react to platform events: when something happens, check conditions, then act. Dry-run a rule against sample events before turning it on."
        actions={canWrite ? <Button variant="primary" iconName="plus16" onClick={() => setOpenRule("new")} disabled={!catalog.data}>New rule</Button> : null}
      />
      {catalog.errorMessage || rules.errorMessage ? <ErrorBlock message={catalog.errorMessage ?? rules.errorMessage ?? ""} onRetry={() => { catalog.reload(); rules.reload(); }} /> : null}
      <div className={styles.layout}>
        <DataTable<RuleRecord>
          caption="Automation rules"
          rows={rules.data?.items ?? []}
          isLoading={rules.isLoading}
          readRowKey={(rule) => rule.id}
          onRowOpen={(rule) => setOpenRule(rule)}
          selectedRowKey={openRule && openRule !== "new" ? openRule.id : null}
          columns={[
            { key: "name", header: "Rule", render: (rule) => <span><strong>{rule.content.name}</strong><br /><span className={styles.note}>{rule.content.description}</span></span> },
            { key: "event", header: "When", render: (rule) => <code>{eventLabel(rule.content.event)}</code> },
            { key: "shape", header: "Logic", width: "150px", render: (rule) => `${rule.content.conditions.length} condition${rule.content.conditions.length === 1 ? "" : "s"} to ${rule.content.actions.length} action${rule.content.actions.length === 1 ? "" : "s"}` },
            { key: "status", header: "Status", width: "90px", render: (rule) => <StatusBadge label={rule.content.isEnabled ? "On" : "Off"} tone={rule.content.isEnabled ? "success" : "neutral"} /> },
            { key: "version", header: "Version", width: "70px", isMono: true, render: (rule) => `v${rule.version}` },
          ]}
        />
        <Card title="Recent runs" isFlush>
          <AutomationExecutionLog executions={executions.data?.items ?? []} isLoading={executions.isLoading} />
        </Card>
      </div>
      {openRule && catalog.data ? (
        <VersionedRecordPanel<AutomationRuleContent>
          key={openRule === "new" ? "new" : `${openRule.id}@${openRule.version}`}
          endpoint={automationRulesEndpoint}
          record={openRule === "new" ? null : openRule}
          blankContent={blankRule}
          title={openRule === "new" ? "Automation rule" : openRule.content.name}
          canWrite={canWrite}
          canArchive
          deriveNewRecordId={(content) => buildRuleIdentifierFromName(content.name)}
          findDraftProblem={findAutomationRuleDraftProblem}
          renderEditor={(content, updateContent, isWritable) => (
            <>
              <AutomationRuleEditor rule={content} catalog={catalog.data!} canWrite={isWritable} onChange={updateContent} />
              <AutomationDryRunPreview rule={content} catalog={catalog.data!} sampleEvents={samples.data?.items ?? []} />
            </>
          )}
          onChanged={(record, verb) => {
            rules.reload();
            setOpenRule(verb === "archived" ? null : record);
            showToast(`Rule "${record.content.name}" ${verb} (v${record.version}).`);
          }}
          onClose={() => setOpenRule(null)}
        />
      ) : null}
      {openRule && !catalog.data ? <LoadingBlock /> : null}
    </>
  );
}
