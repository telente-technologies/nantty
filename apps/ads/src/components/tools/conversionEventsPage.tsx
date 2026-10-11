"use client";

import { useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorState, InlineNotice, LoadingBlock } from "@/components/ui/feedback";
import { CheckboxField, SelectField, TextField } from "@/components/ui/formFields";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, PageHeader } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { toolsApi } from "@/services/toolsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { ConversionEvent, ConversionEventType } from "@/types/tools.type";
import { formatRelativeTimeFromNow } from "@/utils/dateRange.util";
import { formatWholeCount } from "@/utils/numberFormatting.util";

import { conversionEventTypeLabels } from "./toolLabels.constant";
import styles from "./toolsPage.module.css";

const statusDisplay = {
  active: { label: "Receiving events", tone: "success" as const },
  no_recent_activity: { label: "No recent activity", tone: "caution" as const },
  paused: { label: "Paused", tone: "neutral" as const },
};

function CreateConversionEventDialog({ accountId, onClose, onCreated }: { readonly accountId: string; readonly onClose: () => void; readonly onCreated: () => void }) {
  const { account } = useAdAccount();
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState<ConversionEventType>("message_started");
  const [tracksValue, setTracksValue] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function createConversionEvent() {
    if (!name.trim()) {
      setErrorMessage("Name the event.");
      return;
    }
    if (!account.business) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await toolsApi.createConversionEvent(accountId, { name: name.trim().slice(0, 80), eventType, storeId: account.business.storeId, tracksValue });
      onCreated();
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
      setIsSaving(false);
    }
  }

  return (
    <OverlayDialog intent="analytics"
      isOpen
      onClose={onClose}
      title="Custom conversion event"
      description="Count a specific action in your store as a result, for reporting and optimisation."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" isLoading={isSaving} onClick={createConversionEvent}>Create event</Button>
        </>
      }
    >
      <TextField label="Event name" value={name} onValueChange={setName} maxLength={80} placeholder="e.g. Tailoring enquiry" />
      <SelectField label="Counts when someone" value={eventType} onValueChange={setEventType} options={Object.entries(conversionEventTypeLabels).map(([value, label]) => ({ value: value as ConversionEventType, label }))} />
      <CheckboxField label="Track order value" description="Use the order value for return on ad spend." checked={tracksValue} onCheckedChange={setTracksValue} />
      {errorMessage ? <InlineNotice tone="error">{errorMessage}</InlineNotice> : null}
    </OverlayDialog>
  );
}

export function ConversionEventsPage() {
  const { accountId, account, canPerform } = useAdAccount();
  const { showToast } = useToast();
  const eventsQuery = useAdsQuery(() => toolsApi.listConversionEvents(accountId), accountId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const canManageTools = canPerform("tools:manage");

  async function toggleEventPaused(event: ConversionEvent) {
    try {
      await toolsApi.updateConversionEvent(accountId, event.id, { status: event.status === "paused" ? "active" : "paused" });
      showToast(event.status === "paused" ? "Event resumed" : "Event paused");
      eventsQuery.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  const columns: DataTableColumn<ConversionEvent>[] = [
    {
      key: "name",
      header: "Event",
      isAlwaysVisible: true,
      render: (row) => (
        <div className={styles.titleRow}>
          <strong>{row.name}</strong>
          {row.isBuiltIn ? <StatusBadge tone="accent">Built in</StatusBadge> : null}
        </div>
      ),
    },
    { key: "type", header: "Counts", render: (row) => conversionEventTypeLabels[row.eventType] },
    { key: "store", header: "Store", render: (row) => row.storeName },
    { key: "status", header: "Status", render: (row) => <StatusBadge tone={statusDisplay[row.status].tone}>{statusDisplay[row.status].label}</StatusBadge> },
    { key: "count", header: "Last 7 days", align: "end", render: (row) => formatWholeCount(row.countLast7Days), sortValue: (row) => row.countLast7Days },
    { key: "last", header: "Last received", render: (row) => (row.lastReceivedAt ? formatRelativeTimeFromNow(row.lastReceivedAt) : "Never") },
    { key: "value", header: "Value", render: (row) => (row.tracksValue ? "Tracked" : "—") },
    ...(canManageTools
      ? [{ key: "actions", header: "Actions", isAlwaysVisible: true, render: (row: ConversionEvent) => (row.isBuiltIn ? <span className={styles.muted}>Always on</span> : <Button size="small" variant="ghost" onClick={() => toggleEventPaused(row)}>{row.status === "paused" ? "Resume" : "Pause"}</Button>) }]
      : []),
  ];

  return (
    <div className={styles.stack}>
      <PageHeader
        eyebrow="Tools"
        title="Conversion events"
        description="Actions in your Zudomart store that count as results."
        actions={canManageTools && account.business ? <Button variant="primary" iconName="plus16" onClick={() => setIsCreateOpen(true)}>Custom event</Button> : null}
      />
      <InlineNotice tone="info" title="Sales attribution is automatic">
        Orders, carts, checkouts and store visits in your Zudomart store are recorded for you — no pixel or code to install. A sale is credited to an ad when the buyer tapped it within your click window or saw it within your view window.
      </InlineNotice>
      {!account.business ? <InlineNotice tone="caution">Link a store to this ad account (business accounts) to use store conversion events.</InlineNotice> : null}
      {eventsQuery.errorMessage ? <ErrorState error={eventsQuery.error} message={eventsQuery.errorMessage} onRetry={eventsQuery.reload} /> : null}
      <Card padded={false}>
        {eventsQuery.isLoading && !eventsQuery.data ? <LoadingBlock /> : <DataTable caption="Conversion events" columns={columns} rows={eventsQuery.data?.items ?? []} readRowId={(row) => row.id} emptyState="No conversion events. They appear once a store is linked." />}
      </Card>
      {isCreateOpen ? (
        <CreateConversionEventDialog
          accountId={accountId}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false);
            showToast("Conversion event created");
            eventsQuery.reload();
          }}
        />
      ) : null}
    </div>
  );
}
