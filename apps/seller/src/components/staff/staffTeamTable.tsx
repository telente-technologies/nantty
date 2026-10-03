"use client";

import { useMemo } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { StatusBadge } from "@/components/ui/statusBadge";
import { TablePagination } from "@/components/ui/tablePagination";
import { staffRoleLabels, staffRoles } from "@/constants/roles.constant";
import { useClientTableState, type TableSortValueReader } from "@/hooks/useClientTableState.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { StaffMember } from "@/types/staff.type";
import { formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";

import styles from "./staff.module.css";

const staffSortValueReaders: Record<string, TableSortValueReader<StaffMember>> = {
  name: (member) => member.name,
  role: (member) => staffRoles.indexOf(member.role),
  status: (member) => member.status,
  lastActive: (member) => (member.lastActiveAt ? new Date(member.lastActiveAt).getTime() : null),
};

interface StaffTeamTableProps {
  readonly members: StaffMember[] | null;
  readonly isLoading: boolean;
  readonly errorMessage: string | null;
  readonly onRetry: () => void;
  readonly onOpenMember: (member: StaffMember) => void;
  readonly emptyText: string;
}

export function StaffTeamTable({ members, isLoading, errorMessage, onRetry, onOpenMember, emptyText }: StaffTeamTableProps) {
  const { locations } = useStoreContext();
  const locationNameById = useMemo(() => new Map(locations.map((location) => [location.id, location.name])), [locations]);
  const table = useClientTableState(members, staffSortValueReaders, { pageSize: 10, initialSort: { key: "role", direction: "ascending" } });

  const columns: DataTableColumn<StaffMember>[] = [
    {
      key: "name",
      header: "Name",
      sortKey: "name",
      render: (member) => (
        <span className={styles.memberName}>
          <strong>{member.name}</strong>
          <span className={styles.memberContact}>@{member.username}</span>
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortKey: "role",
      render: (member) => (
        <span className={styles.badgeRow}>
          {staffRoleLabels[member.role]}
          {member.permissions ? <StatusBadge tone="highlight">Custom</StatusBadge> : null}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      render: (member) => <StatusBadge tone={member.status === "active" ? "success" : member.status === "invited" ? "info" : "neutral"}>{member.status === "active" ? "Active" : member.status === "invited" ? "Waiting to accept" : "Suspended"}</StatusBadge>,
    },
    { key: "locations", header: "Locations", hideBelowTablet: true, render: (member) => member.locationIds.map((locationId) => locationNameById.get(locationId) ?? locationId).join(", ") },
    { key: "lastActive", header: "Last active", sortKey: "lastActive", hideBelowTablet: true, render: (member) => (member.lastActiveAt ? formatRelativeTimeFromNow(member.lastActiveAt) : "Never") },
  ];

  return (
    <DataTable<StaffMember>
      caption="Team members"
      columns={columns}
      rows={table.visibleRows}
      isLoading={isLoading}
      readRowKey={(member) => member.id}
      onRowActivate={onOpenMember}
      sortState={table.sortState}
      onSortChange={table.setSortState}
      errorMessage={errorMessage}
      onRetry={onRetry}
      emptyState={emptyText}
      footer={table.totalCount > table.pageSize ? <TablePagination pageIndex={table.pageIndex} pageCount={table.pageCount} totalCount={table.totalCount} pageSize={table.pageSize} onPageChange={table.setPageIndex} itemLabel="people" /> : undefined}
    />
  );
}
