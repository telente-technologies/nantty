"use client";

import { useState } from "react";

import { requestConfirmation } from "@nantty/web-kit";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { SwitchToggle } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, PageHeader } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { toolsApi } from "@/services/toolsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { AutomatedRule } from "@/types/tools.type";
import { formatRelativeTimeFromNow } from "@/utils/dateRange.util";

import { describeRuleActionInPlainEnglish, describeRuleConditionInPlainEnglish } from "./ruleDescription.util";
import { RuleEditorDialog } from "./ruleEditorDialog";
import { ruleCheckFrequencyOptions } from "./toolLabels.constant";
import styles from "./toolsPage.module.css";

type EditorState = { readonly rule: AutomatedRule | null } | null;

export function RulesPage() {
  const { accountId, currency, canPerform } = useAdAccount();
  const { showToast } = useToast();
  const rulesQuery = useAdsQuery(() => toolsApi.listRules(accountId), accountId);
  const [editorState, setEditorState] = useState<EditorState>(null);
  const canManageTools = canPerform("tools:manage");
  const rules = rulesQuery.data?.items ?? [];

  async function runRuleChange(change: () => Promise<unknown>, successMessage: string) {
    try {
      await change();
      showToast(successMessage);
      rulesQuery.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  return (
    <div className={styles.stack}>
      <PageHeader
        eyebrow="Tools"
        title="Automated rules"
        description="Pause poor performers, scale winners or get alerts, without watching the dashboard all day."
        actions={canManageTools ? <Button variant="primary" iconName="plus16" onClick={() => setEditorState({ rule: null })}>New rule</Button> : null}
      />
      {rulesQuery.errorMessage ? <ErrorState error={rulesQuery.error} message={rulesQuery.errorMessage} onRetry={rulesQuery.reload} /> : null}
      <Card padded={false}>
        {rulesQuery.isLoading && !rulesQuery.data ? <LoadingBlock /> : null}
        {!rulesQuery.isLoading && rules.length === 0 ? <EmptyState iconName="slidersHorizontal24" title="No rules yet" description="For example: pause any ad whose cost per click passes a limit over 3 days." /> : null}
        <ul className={styles.list}>
          {rules.map((rule) => (
            <li key={rule.id} className={styles.listRow}>
              <div className={styles.listMain}>
                <div className={styles.titleRow}>
                  <h2>{rule.name}</h2>
                  <StatusBadge tone={rule.status === "active" ? "success" : "neutral"}>{rule.status === "active" ? "On" : "Off"}</StatusBadge>
                </div>
                <p className={styles.muted}>If</p>
                <ul className={styles.conditionList}>
                  {rule.conditions.map((condition, index) => (
                    <li key={index}>{describeRuleConditionInPlainEnglish(condition, currency)}</li>
                  ))}
                </ul>
                <p>
                  <span className={styles.muted}>Then </span>
                  {describeRuleActionInPlainEnglish(rule)}
                </p>
                <p className={styles.muted}>
                  {ruleCheckFrequencyOptions.find((option) => Number(option.value) === rule.checkEveryMinutes)?.label ?? "Every hour"} · last checked {rule.lastRunAt ? formatRelativeTimeFromNow(rule.lastRunAt) : "never"} · acted {rule.triggerCount} time{rule.triggerCount === 1 ? "" : "s"}
                  {rule.lastTriggeredAt ? `, last ${formatRelativeTimeFromNow(rule.lastTriggeredAt)}` : ""}
                </p>
              </div>
              {canManageTools ? (
                <div className={styles.rowEnd}>
                  <SwitchToggle label={`Turn ${rule.name} ${rule.status === "active" ? "off" : "on"}`} hideLabel checked={rule.status === "active"} onCheckedChange={(checked) => runRuleChange(() => toolsApi.updateRule(accountId, rule.id, { status: checked ? "active" : "paused" }), checked ? "Rule turned on" : "Rule turned off")} />
                  <Button size="small" variant="ghost" onClick={() => setEditorState({ rule })}>Edit</Button>
                  <Button
                    size="small"
                    variant="ghost"
                    iconName="trash24"
                    aria-label={`Delete ${rule.name}`}
                    onClick={async () => {
                      if (await requestConfirmation({ title: `Delete "${rule.name}"?`, description: "It stops running straight away.", confirmLabel: "Delete rule", tone: "danger", intent: "delete" })) void runRuleChange(() => toolsApi.deleteRule(accountId, rule.id), "Rule deleted");
                    }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
      {editorState ? (
        <RuleEditorDialog
          existingRule={editorState.rule}
          onClose={() => setEditorState(null)}
          onSaved={() => {
            showToast(editorState.rule ? "Rule saved" : "Rule created");
            setEditorState(null);
            rulesQuery.reload();
          }}
        />
      ) : null}
    </div>
  );
}
