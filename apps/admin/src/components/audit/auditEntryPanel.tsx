"use client";

import { DiffView } from "@/components/ui/diffView";
import { NoticeBanner } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import type { AuditLogEntry } from "@/types/audit.type";
import { formatDateTime } from "@/utils/formatting.util";

export function AuditEntryPanel({ entry, onClose }: { readonly entry: AuditLogEntry; readonly onClose: () => void }) {
  return (
    <SidePanel isOpen width="wide" onClose={onClose} title={<code>{entry.action}</code>} subtitle={formatDateTime(entry.occurredAt)}>
      <NoticeBanner tone="info">Audit entries are append-only. Nobody, including superadmins, can edit or delete them.</NoticeBanner>
      <KeyValueList
        columns={2}
        items={[
          { label: "Who", value: `${entry.actor.name}${entry.actor.role ? ` (${entry.actor.role.toLowerCase()})` : ""}` },
          { label: "Actor ID", value: entry.actor.id, isMono: true },
          { label: "Target", value: `${entry.target.type} · ${entry.target.label}` },
          { label: "Target ID", value: entry.target.id, isMono: true },
          { label: "Area", value: entry.area },
          { label: "Step-up", value: entry.stepUpVerified ? <StatusBadge label="Verified" tone="night" hasDot={false} /> : "Not required" },
          { label: "IP address", value: entry.ipAddress ?? "—", isMono: true },
          { label: "Request ID", value: entry.requestId, isMono: true },
        ]}
      />
      <SectionHeading>Reason</SectionHeading>
      <p>{entry.reason ?? "No reason recorded."}</p>
      <SectionHeading>Before and after</SectionHeading>
      <DiffView before={entry.before} after={entry.after} />
    </SidePanel>
  );
}
