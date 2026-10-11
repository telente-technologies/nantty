"use client";

import Link from "next/link";
import { useState } from "react";

import { DataTable } from "@/components/ui/dataTable";
import { ErrorBlock, NoticeBanner } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchManipulationFlags } from "@/services/rankingApi.service";
import type { SuspensionCaseSummary } from "@/types/suspensions.type";
import { formatDateTime } from "@/utils/formatting.util";

import styles from "./ranking.module.css";

const signalLabels: Readonly<Record<string, string>> = {
  coordinated_cluster: "Coordinated cluster",
  engagement_burst: "Engagement burst",
  reciprocal_pod: "Engagement pod",
  new_account_engagement: "New-account engagement",
  low_trust_engagement: "Low-trust engagement",
  suspended_engagers: "Suspended engagers",
  purchased_engagement: "Purchased engagement",
  spam_hashtags: "Spammy hashtags",
};

const statusOptions = [{ value: "OPEN", label: "Open" }, { value: "DECIDED", label: "Decided" }, { value: "ALL", label: "All" }];

export function ManipulationFlagsWorkspace() {
  const [status, setStatus] = useState("OPEN");
  const query = useAdminQuery((signal) => fetchManipulationFlags(status, signal), `manipulation-flags-${status}`);
  return (
    <>
      <PageHeader area="Trust & safety" title="Manipulation flags" description="Accounts whose posts got engagement that looks fake. The feed already discounts it and keeps it out of trends; these flags are advisory for review." />
      <div className={styles.stack}>
        <NoticeBanner tone="info">Flags come from the intelligence service and open as suspension cases. Decide them in the suspension queue so the decision is audited with a reason.</NoticeBanner>
        <SelectField label="Status" options={statusOptions} value={status} onChange={(event) => setStatus(event.target.value)} />
        {query.errorMessage ? <ErrorBlock error={query.error} message={query.errorMessage} onRetry={query.reload} /> : (
          <DataTable<SuspensionCaseSummary>
            caption="Engagement manipulation flags"
            rows={query.data?.items ?? []}
            isLoading={query.isLoading}
            readRowKey={(row) => row.id}
            emptyMessage="No manipulation flags right now."
            columns={[
              { key: "user", header: "Account", render: (row) => <Link href={`/users/${row.user.id}`}>@{row.user.username}</Link> },
              { key: "risk", header: "Score", align: "end", render: (row) => row.riskScore },
              { key: "signals", header: "Signals", render: (row) => <span className={styles.signals}>{row.topSignals.map((signal) => <StatusBadge key={signal} status="flag" tone="caution" label={signalLabels[signal] ?? signal} hasDot={false} />)}</span> },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
              { key: "created", header: "Flagged", render: (row) => formatDateTime(row.createdAt) },
              { key: "open", header: "", align: "end", render: (row) => <Link href="/moderation/suspensions">Review in queue</Link> },
            ]}
          />
        )}
      </div>
    </>
  );
}
