"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { CursorPagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { UserIdentity } from "@/components/ui/userIdentity";
import { VerificationBadge } from "@/components/ui/verificationBadge";
import { userRiskOptions, userRoleOptions, userStatusOptions, userVerificationOptions } from "@/constants/peopleFilterOptions.constant";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchPlatformUsers } from "@/services/peopleApi.service";
import type { PlatformUserSummary } from "@/types/platformUser.type";
import { formatRelativeTimeFromNow, formatWholeNumber } from "@/utils/formatting.util";

import styles from "./peopleWorkspace.module.css";

const userColumns: readonly DataTableColumn<PlatformUserSummary>[] = [
  { key: "user", header: "User", render: (user) => <UserIdentity user={user} /> },
  { key: "status", header: "Status", render: (user) => <StatusBadge status={user.status} /> },
  { key: "verification", header: "Verification", render: (user) => (user.verification ? <VerificationBadge verification={user.verification} isLabelShown /> : <span className={styles.faint}>None</span>) },
  {
    key: "roles",
    header: "Roles",
    render: (user) => (
      <span className={styles.roleTags}>
        {user.isSeller ? <StatusBadge label="Seller" tone="info" hasDot={false} /> : null}
        {user.isCreator ? <StatusBadge label="Creator" tone="brand" hasDot={false} /> : null}
        {!user.isSeller && !user.isCreator ? <span className={styles.faint}>Member</span> : null}
      </span>
    ),
  },
  { key: "country", header: "Country", render: (user) => `${user.country} · ${user.currency}`, isMono: true },
  { key: "followers", header: "Followers", render: (user) => formatWholeNumber(user.followerCount, { compact: true }), align: "end", isMono: true },
  { key: "strikes", header: "Strikes", render: (user) => user.strikeCount, align: "end", isMono: true },
  { key: "risk", header: "Risk", render: (user) => <StatusBadge status={user.riskLevel} /> },
  { key: "lastActive", header: "Last active", render: (user) => <span className={styles.muted}>{formatRelativeTimeFromNow(user.lastActiveAt)}</span> },
];

export function UsersListWorkspace({ initialSearch }: { readonly initialSearch: string }) {
  const router = useRouter();
  const [searchText, setSearchText] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [status, setStatus] = useState("");
  const [verification, setVerification] = useState("");
  const [role, setRole] = useState("");
  const [risk, setRisk] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();

  useEffect(() => {
    setSearchText(initialSearch);
    setDebouncedSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchText);
      setCursor(undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const filters = { search: debouncedSearch.trim() || undefined, status, verification, role, risk, cursor };
  const { data, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchPlatformUsers(filters, signal), JSON.stringify(filters));

  function updateFilter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setCursor(undefined);
    };
  }

  return (
    <>
      <PageHeader area="People" title="Users" description="Find any account by @username, name or ID. Personal data stays masked unless you have permission to reveal it." />
      <div className={styles.filters}>
        <TextField label="Search" isLabelHidden placeholder="Search @username, name or usr_ ID" value={searchText} onChange={(event) => setSearchText(event.target.value)} type="search" />
        <SelectField label="Status" isLabelHidden options={userStatusOptions} value={status} onChange={(event) => updateFilter(setStatus)(event.target.value)} />
        <SelectField label="Verification" isLabelHidden options={userVerificationOptions} value={verification} onChange={(event) => updateFilter(setVerification)(event.target.value)} />
        <SelectField label="Role" isLabelHidden options={userRoleOptions} value={role} onChange={(event) => updateFilter(setRole)(event.target.value)} />
        <SelectField label="Risk" isLabelHidden options={userRiskOptions} value={risk} onChange={(event) => updateFilter(setRisk)(event.target.value)} />
      </div>
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      <DataTable
        caption="Users"
        columns={userColumns}
        rows={data?.items ?? []}
        readRowKey={(user) => user.id}
        onRowOpen={(user) => router.push(`/users/${user.id}`)}
        isLoading={isLoading}
        emptyMessage="No users match these filters."
        readRowTone={(user) => (user.status === "BANNED" || user.status === "SUSPENDED" ? "danger" : user.riskLevel === "HIGH" ? "caution" : null)}
      />
      <CursorPagination cursor={cursor} nextCursor={data?.nextCursor} onCursorChange={setCursor} />
    </>
  );
}
