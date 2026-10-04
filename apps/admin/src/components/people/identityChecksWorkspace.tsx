"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { LinkTabs, SegmentedTabs } from "@/components/ui/tabs";
import { identityCaseStatusTabs, identityCheckTone, identityReasonCopy, verificationViewTabs } from "@/constants/identityVerification.constant";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchIdentityCases } from "@/services/identityVerificationApi.service";
import type { IdentityCaseListItem, IdentityCaseStatus } from "@/types/identityVerification.type";
import { formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./peopleWorkspace.module.css";

const columns: readonly DataTableColumn<IdentityCaseListItem>[] = [
  { key: "profile", header: "Profile", render: (item) => <span><strong>{item.profileName || item.profileHandle}</strong><br /><span className={styles.muted}>@{item.profileHandle}</span></span> },
  { key: "badge", header: "Badge", render: (item) => humanizeConstantName(item.color) },
  {
    key: "checks",
    header: "Smile ID checks",
    render: (item) => (
      <span className={styles.stack}>
        <StatusBadge tone={identityCheckTone[item.checks.liveness]} label={`Liveness ${humanizeConstantName(item.checks.liveness)}`} />
        <StatusBadge tone={identityCheckTone[item.checks.faceMatch]} label={`Face ${humanizeConstantName(item.checks.faceMatch)}`} />
      </span>
    ),
  },
  { key: "name", header: "Name match", render: (item) => `${Math.round(item.checks.nameMatchScore * 100)}%`, isMono: true },
  { key: "trust", header: "Trust", render: (item) => String(item.trustScore), isMono: true },
  { key: "why", header: "Why it needs review", render: (item) => (item.decisionReasons.length === 0 ? <span className={styles.faint}>—</span> : identityReasonCopy[item.decisionReasons[0] ?? ""] ?? humanizeConstantName(item.decisionReasons[0] ?? "")) },
  { key: "fraud", header: "Fraud", render: (item) => (item.fraudSignals.length > 0 ? <StatusBadge tone="danger" label={`${item.fraudSignals.length} signal${item.fraudSignals.length > 1 ? "s" : ""}`} /> : <span className={styles.faint}>None</span>) },
  { key: "paid", header: "Paid", render: (item) => <span className={styles.muted}>{formatRelativeTimeFromNow(item.createdAt)}</span> },
];

export function IdentityChecksWorkspace() {
  const router = useRouter();
  const [status, setStatus] = useState<IdentityCaseStatus>("under_review");
  const { data, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchIdentityCases(status, signal), status);

  return (
    <>
      <PageHeader area="People" title="Identity checks" description="Paid Blue and Gold checkmarks verified with Smile ID (selfie liveness, photo ID, face match and a government lookup where available). Clean results are approved automatically; everything else waits here. Rejecting refunds the payment automatically." />
      <LinkTabs label="Verification views" items={verificationViewTabs} />
      <SegmentedTabs label="Identity check status" items={identityCaseStatusTabs} activeKey={status} onChange={setStatus} />
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      <DataTable
        caption="Identity checks"
        columns={columns}
        rows={data?.data ?? []}
        readRowKey={(item) => item.id}
        onRowOpen={(item) => router.push(`/verification/identity/${item.id}`)}
        isLoading={isLoading}
        emptyMessage="Nothing waiting here."
        readRowTone={(item) => (item.fraudSignals.length > 0 ? "caution" : null)}
      />
    </>
  );
}
