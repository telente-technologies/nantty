import { DataTable } from "@/components/ui/dataTable";
import { StatusBadge } from "@/components/ui/statusBadge";
import type { AutomationExecution } from "@/types/automation.type";
import { formatDateTime, formatRelativeTimeFromNow } from "@/utils/formatting.util";

import styles from "./automation.module.css";

const outcomeBadges: Record<AutomationExecution["outcome"], { label: string; tone: "success" | "neutral" | "danger" }> = {
  ACTIONS_RUN: { label: "Actions ran", tone: "success" },
  CONDITIONS_NOT_MET: { label: "Skipped", tone: "neutral" },
  FAILED: { label: "Failed", tone: "danger" },
};

export function AutomationExecutionLog({ executions, isLoading }: { readonly executions: readonly AutomationExecution[]; readonly isLoading: boolean }) {
  return (
    <DataTable<AutomationExecution>
      caption="Recent automation runs"
      rows={executions}
      isLoading={isLoading}
      readRowKey={(execution) => execution.id}
      emptyMessage="No runs recorded yet."
      columns={[
        { key: "when", header: "When", width: "120px", render: (execution) => <time dateTime={execution.occurredAt} title={formatDateTime(execution.occurredAt)}>{formatRelativeTimeFromNow(execution.occurredAt)}</time> },
        { key: "rule", header: "Rule", render: (execution) => execution.ruleName },
        { key: "subject", header: "Subject", render: (execution) => <span className={styles.note}>{execution.subjectLabel}</span> },
        { key: "outcome", header: "Outcome", width: "120px", render: (execution) => <StatusBadge label={outcomeBadges[execution.outcome].label} tone={outcomeBadges[execution.outcome].tone} /> },
        { key: "detail", header: "Detail", render: (execution) => <span className={styles.note}>{execution.errorMessage ?? (execution.actionsRun.join(", ") || "—")}</span> },
      ]}
    />
  );
}
