"use client";

import { useState } from "react";

import { DiffView } from "@/components/ui/diffView";
import { StatusBadge } from "@/components/ui/statusBadge";
import type { AuditLogEntry } from "@/types/audit.type";
import { formatDateTime, formatRelativeTimeFromNow } from "@/utils/formatting.util";

import styles from "./auditHistoryList.module.css";

export function AuditHistoryList({ entries, emptyMessage = "No admin actions recorded yet." }: { readonly entries?: readonly AuditLogEntry[]; readonly emptyMessage?: string }) {
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  if (!entries || entries.length === 0) return <p className={styles.empty}>{emptyMessage}</p>;
  return (
    <ol className={styles.timeline}>
      {entries.map((entry) => {
        const isExpanded = expandedEntryId === entry.id;
        const hasDiff = entry.before !== null || entry.after !== null;
        return (
          <li key={entry.id} className={styles.entry}>
            <div className={styles.headline}>
              <code className={styles.action}>{entry.action}</code>
              {entry.stepUpVerified ? <StatusBadge label="Step-up verified" tone="night" hasDot={false} /> : null}
            </div>
            <p className={styles.who}>
              <strong>{entry.actor.name}</strong>
              {entry.actor.role ? <span className={styles.role}> {entry.actor.role.toLowerCase()}</span> : null} · <time dateTime={entry.occurredAt} title={formatDateTime(entry.occurredAt)}>{formatRelativeTimeFromNow(entry.occurredAt)}</time>
            </p>
            {entry.reason ? <p className={styles.reason}>“{entry.reason}”</p> : null}
            {hasDiff ? (
              <button type="button" className={styles.toggle} aria-expanded={isExpanded} onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}>
                {isExpanded ? "Hide changes" : "Show before / after"}
              </button>
            ) : null}
            {isExpanded ? <DiffView before={entry.before} after={entry.after} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
