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
import { LinkTabs, SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { verificationViewTabs } from "@/constants/identityVerification.constant";
import { verificationColorOptions, verificationStatusTabs } from "@/constants/peopleFilterOptions.constant";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchVerificationApplications } from "@/services/peopleReviewsApi.service";
import type { VerificationApplication } from "@/types/verification.type";
import { formatMoneyForDisplay, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { VerificationTierLabel } from "./verificationTierLabel";
import styles from "./peopleWorkspace.module.css";

type StatusTabKey = (typeof verificationStatusTabs)[number]["key"];

const verificationColumns: readonly DataTableColumn<VerificationApplication>[] = [
  { key: "applicant", header: "Applicant", render: (application) => <UserIdentity user={application.user} /> },
  { key: "requested", header: "Requested", render: (application) => <VerificationTierLabel color={application.color} tier={application.tier} /> },
  { key: "subject", header: "Subject", render: (application) => application.applicant.businessName ?? application.applicant.agencyName ?? humanizeConstantName(application.subjectKind) },
  { key: "plan", header: "Plan", render: (application) => (application.subscription ? formatMoneyForDisplay(application.subscription.price) : <span className={styles.faint}>Not purchasable</span>), isMono: true },
  {
    key: "checks",
    header: "Checks",
    render: (application) => {
      const failed = application.checks.filter((check) => check.result === "FAIL").length;
      const review = application.checks.filter((check) => check.result === "REVIEW").length;
      return failed > 0 ? <StatusBadge tone="danger" label={`${failed} failed`} /> : review > 0 ? <StatusBadge tone="caution" label={`${review} to review`} /> : <StatusBadge tone="success" label="All passed" />;
    },
  },
  { key: "submitted", header: "Submitted", render: (application) => <span className={styles.muted}>{formatRelativeTimeFromNow(application.submittedAt)}</span> },
  { key: "status", header: "Status", render: (application) => <StatusBadge status={application.status} /> },
];

export function VerificationQueueWorkspace() {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState<StatusTabKey>("PENDING");
  const [color, setColor] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const filters = { status: statusTab, color: color || undefined, search: search.trim() || undefined, cursor };
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchVerificationApplications(filters, signal), JSON.stringify(filters));

  return (
    <>
      <PageHeader area="People" title="Verification reviews" description="Blue is personal (including creator accounts), Gold is business and unlocks the Zudomart Dashboard, Black is government and only granted through the official process." />
      <LinkTabs label="Verification views" items={verificationViewTabs} />
      <SegmentedTabs label="Verification status" items={verificationStatusTabs} activeKey={statusTab} onChange={(key) => { setStatusTab(key); setCursor(undefined); }} />
      <Toolbar>
        <TextField label="Search" isLabelHidden type="search" placeholder="Search @username, legal or business name" value={search} onChange={(event) => { setSearch(event.target.value); setCursor(undefined); }} />
        <SelectField label="Badge" isLabelHidden options={verificationColorOptions} value={color} onChange={(event) => { setColor(event.target.value); setCursor(undefined); }} />
      </Toolbar>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable
        caption="Verification requests"
        columns={verificationColumns}
        rows={data?.items ?? []}
        readRowKey={(application) => application.id}
        onRowOpen={(application) => router.push(`/verification/${application.id}`)}
        isLoading={isLoading}
        emptyMessage="No verification requests here."
      />
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
    </>
  );
}
