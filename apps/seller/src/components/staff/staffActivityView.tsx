"use client";

import { useEffect, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { ErrorCallout } from "@/components/ui/feedback";
import { DateRangeControl, FilterBar, type DateRangeValue } from "@/components/ui/filterControls";
import { SelectField } from "@/components/ui/formFields";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { staffRoleLabels } from "@/constants/roles.constant";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { AuditLogEntry, StaffMember } from "@/types/staff.type";
import { convertRowsToCsvText, triggerBrowserDownload } from "@/utils/csvFile.util";
import { buildDateRangeEndingToday, formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

const actionAreaOptions = [
  { value: "", label: "All activity" },
  { value: "inventory.", label: "Stock" },
  { value: "staff.", label: "Team" },
  { value: "settings.", label: "Settings" },
  { value: "location.", label: "Locations" },
  { value: "storefront.", label: "Storefront" },
  { value: "developer.", label: "API & webhooks" },
  { value: "security.", label: "Security" },
  { value: "integration.", label: "Integrations" },
  { value: "order.", label: "Orders" },
  { value: "payout.", label: "Payouts" },
  { value: "subscription.", label: "Billing" },
];

export function StaffActivityView() {
  const [dateRange, setDateRange] = useState<DateRangeValue>(buildDateRangeEndingToday(30));
  const [actorId, setActorId] = useState("");
  const [actionArea, setActionArea] = useState("");
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const { showToast } = useToast();
  const staffQuery = useSellerQuery<CursorPage<StaffMember>>("/seller/staff", { limit: 200 });
  const filters = { actorId, action: actionArea, from: dateRange.from, to: dateRange.to, limit: 50 };
  const auditQuery = useSellerQuery<CursorPage<AuditLogEntry>>("/seller/audit-log", filters);

  useEffect(() => {
    setEntries(auditQuery.data?.data ?? []);
    setNextCursor(auditQuery.data?.nextCursor ?? null);
  }, [auditQuery.data]);

  async function loadMoreEntries() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const page = await sendSellerApiRequest<CursorPage<AuditLogEntry>>("/seller/audit-log", { query: { ...filters, cursor: nextCursor } });
      setEntries((current) => [...current, ...page.data]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsLoadingMore(false);
    }
  }

  function exportVisibleEntriesAsCsv() {
    const csvText = convertRowsToCsvText(
      ["Time", "Person", "Role", "Action", "Summary", "IP address"],
      entries.map((entry) => [entry.createdAt, entry.actor.name, staffRoleLabels[entry.actor.role], entry.action, entry.summary, entry.ipAddress ?? ""]),
    );
    triggerBrowserDownload(`staff-activity-${dateRange.from}-to-${dateRange.to}.csv`, csvText);
  }

  return (
    <PageStack>
      <PageHeader title="Staff activity" description="Every sensitive change in your store: refunds, discounts, stock, staff, settings and payouts." actions={<ButtonLink href="/staff">Back to staff</ButtonLink>} />
      <FilterBar>
        <DateRangeControl value={dateRange} onValueChange={setDateRange} />
        <SelectField label="Person" hideLabel value={actorId} onChange={(event) => setActorId(event.target.value)} options={[{ value: "", label: "Everyone" }, ...(staffQuery.data?.data ?? []).map((member) => ({ value: member.userId, label: member.name }))]} />
        <SelectField label="Area" hideLabel value={actionArea} onChange={(event) => setActionArea(event.target.value)} options={actionAreaOptions} />
        <Button iconName="export24" onClick={exportVisibleEntriesAsCsv} disabled={entries.length === 0}>
          Export CSV
        </Button>
      </FilterBar>
      {auditQuery.errorMessage ? <ErrorCallout error={auditQuery.error} message={auditQuery.errorMessage} onRetry={auditQuery.reload} /> : null}
      <Panel padded={false}>
        <DataTable<AuditLogEntry>
          caption="Staff activity"
          rows={auditQuery.data ? entries : null}
          isLoading={auditQuery.isLoading}
          readRowKey={(entry) => entry.id}
          emptyState="No activity matches these filters."
          hasMore={nextCursor !== null}
          onLoadMore={() => void loadMoreEntries()}
          isLoadingMore={isLoadingMore}
          columns={[
            { key: "time", header: "When", width: "170px", render: (entry) => formatDateTimeForDisplay(entry.createdAt) },
            { key: "actor", header: "Who", render: (entry) => <>{entry.actor.name} <StatusBadge>{staffRoleLabels[entry.actor.role]}</StatusBadge></> },
            { key: "summary", header: "What happened", render: (entry) => entry.summary },
            { key: "ip", header: "IP address", hideBelowTablet: true, render: (entry) => entry.ipAddress ?? "—" },
          ]}
        />
      </Panel>
    </PageStack>
  );
}
