"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { applicationStatusTabs } from "@/constants/peopleFilterOptions.constant";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchProgramApplications } from "@/services/peopleReviewsApi.service";
import type { ApplicationKind, ProgramApplication } from "@/types/applications.type";
import { formatMoneyForDisplay, formatRelativeTimeFromNow, formatWholeNumber } from "@/utils/formatting.util";

import { ProgramApplicationPanel } from "./programApplicationPanel";
import styles from "./peopleWorkspace.module.css";

type StatusTabKey = (typeof applicationStatusTabs)[number]["key"];

const pageCopy: Record<ApplicationKind, { title: string; description: string }> = {
  sellers: { title: "Seller applications", description: "People asking to sell on Nantty Mart. Approving lets them list products; Gold verification is separate and unlocks the Dashboard." },
  creators: { title: "Creator Program applications", description: "Creator Program members can go live, receive gifts and earn a share of ad revenue on their content." },
};

function buildColumns(kind: ApplicationKind): DataTableColumn<ProgramApplication>[] {
  const eligibilityColumn: DataTableColumn<ProgramApplication> = {
    key: "eligibility",
    header: "Eligibility",
    render: (application) => {
      const unmet = application.eligibility.filter((check) => !check.isMet).length;
      return unmet === 0 ? <StatusBadge tone="success" label="All rules met" /> : <StatusBadge tone="caution" label={`${unmet} rule${unmet === 1 ? "" : "s"} not met`} />;
    },
  };
  const kindSpecific: DataTableColumn<ProgramApplication>[] =
    kind === "sellers"
      ? [
          { key: "store", header: "Store", render: (application) => <strong>{application.storeName}</strong> },
          { key: "categories", header: "Categories", render: (application) => <span className={styles.muted}>{application.categories.join(", ")}</span> },
          { key: "volume", header: "Expected monthly sales", render: (application) => formatMoneyForDisplay(application.expectedMonthlySales), align: "end", isMono: true },
        ]
      : [
          { key: "niche", header: "Niche", render: (application) => application.contentNiche },
          { key: "followers", header: "Followers", render: (application) => formatWholeNumber(application.user.followerCount, { compact: true }), align: "end", isMono: true },
        ];
  return [
    { key: "applicant", header: "Applicant", render: (application) => <UserIdentity user={application.user} /> },
    ...kindSpecific,
    eligibilityColumn,
    { key: "submitted", header: "Submitted", render: (application) => <span className={styles.muted}>{formatRelativeTimeFromNow(application.submittedAt)}</span> },
    { key: "status", header: "Status", render: (application) => <StatusBadge status={application.status} /> },
  ];
}

export function ProgramApplicationsWorkspace({ kind }: { readonly kind: ApplicationKind }) {
  const [statusTab, setStatusTab] = useState<StatusTabKey>("PENDING");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const filters = { status: statusTab, search: search.trim() || undefined, cursor };
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchProgramApplications(kind, filters, signal), `${kind}:${JSON.stringify(filters)}`);

  return (
    <>
      <PageHeader area="People · Applications" title={pageCopy[kind].title} description={pageCopy[kind].description} />
      <SegmentedTabs label="Application status" items={applicationStatusTabs} activeKey={statusTab} onChange={(key) => { setStatusTab(key); setCursor(undefined); }} />
      <Toolbar>
        <TextField label="Search" isLabelHidden type="search" placeholder="Search @username or name" value={search} onChange={(event) => { setSearch(event.target.value); setCursor(undefined); }} />
      </Toolbar>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable
        caption={pageCopy[kind].title}
        columns={buildColumns(kind)}
        rows={data?.items ?? []}
        readRowKey={(application) => application.id}
        onRowOpen={(application) => setSelectedApplicationId(application.id)}
        selectedRowKey={selectedApplicationId}
        isLoading={isLoading}
        emptyMessage="No applications here."
      />
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
      {selectedApplicationId ? <ProgramApplicationPanel kind={kind} applicationId={selectedApplicationId} onClose={() => setSelectedApplicationId(null)} onDecided={reload} /> : null}
    </>
  );
}
