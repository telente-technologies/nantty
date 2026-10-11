"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { copyrightWorkTypeOptions } from "@/constants/trustOptions.constant";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchCopyrightClaims, type CopyrightClaimFilters } from "@/services/trustApi.service";
import type { CopyrightClaimSummary } from "@/types/copyright.type";
import { formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { CopyrightPolicyCard } from "./copyrightPolicyCard";
import { ModeratedTargetTableCell } from "./moderatedTargetPreview";
import styles from "./trustShared.module.css";

const statusTabs = [
  { key: "OPEN", label: "Open" },
  { key: "UPHELD", label: "Upheld" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
] as const;

const claimColumns: readonly DataTableColumn<CopyrightClaimSummary>[] = [
  { key: "work", header: "Claimed work", render: (claim) => <span className={styles.targetCellText}><span className={styles.truncate}>{claim.workTitle}</span><span className={styles.muted}>{claim.claimant.organization ?? claim.claimant.name} · {humanizeConstantName(claim.workType)}</span></span> },
  { key: "target", header: "Target", render: (claim) => <ModeratedTargetTableCell target={claim.target} /> },
  { key: "infringer", header: "Uploader", render: (claim) => <UserIdentity user={claim.infringer} size={24} /> },
  { key: "strikes", header: "Strikes", align: "end", isMono: true, render: (claim) => claim.infringerStrikeCount },
  { key: "match", header: "Audio match", align: "end", isMono: true, render: (claim) => (claim.topAudioMatchConfidencePercent === null ? "—" : `${claim.topAudioMatchConfidencePercent}%`) },
  { key: "flag", header: "Target", render: (claim) => <StatusBadge status={claim.targetFlag} label={humanizeConstantName(claim.targetFlag)} tone={claim.targetFlag === "TAKEN_DOWN" ? "danger" : claim.targetFlag === "LIMITED" ? "caution" : "success"} /> },
  { key: "status", header: "Claim", render: (claim) => <StatusBadge status={claim.status} /> },
  { key: "filed", header: "Filed", render: (claim) => formatRelativeTimeFromNow(claim.filedAt) },
];

export function CopyrightClaimsWorkspace() {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState<(typeof statusTabs)[number]["key"]>("OPEN");
  const [filters, setFilters] = useState<Omit<CopyrightClaimFilters, "status">>({});
  const queryFilters: CopyrightClaimFilters = { ...filters, status: statusTab };
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchCopyrightClaims(queryFilters, signal), JSON.stringify(queryFilters));

  return (
    <>
      <PageHeader area="Trust & safety" title="Copyright claims" description="Takedown requests from rights holders, counter-notices from creators, and audio fingerprint matches from the intelligence service." />
      <CopyrightPolicyCard />
      <SegmentedTabs label="Claim status" items={statusTabs} activeKey={statusTab} onChange={(key) => { setStatusTab(key); setFilters((current) => ({ ...current, cursor: undefined })); }} />
      <Toolbar>
        <div className={styles.filters}>
          <TextField label="Search" isLabelHidden type="search" placeholder="Search work, claimant, @uploader or claim ID" value={filters.search ?? ""} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value || undefined, cursor: undefined }))} />
          <SelectField label="Work type" isLabelHidden options={copyrightWorkTypeOptions} value={filters.workType ?? ""} onChange={(event) => setFilters((current) => ({ ...current, workType: event.target.value || undefined, cursor: undefined }))} />
        </div>
      </Toolbar>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Copyright claims" columns={claimColumns} rows={data?.items ?? []} readRowKey={(claim) => claim.id} onRowOpen={(claim) => router.push(`/moderation/copyright/${claim.id}`)} isLoading={isLoading} readRowTone={(claim) => (claim.infringerStrikeCount >= 2 && claim.status === "PENDING" ? "caution" : null)} emptyMessage="No claims here." />
      <CursorPagination cursor={filters.cursor} nextCursor={data?.nextCursor} onCursorChange={(cursor) => setFilters((current) => ({ ...current, cursor }))} />
    </>
  );
}
