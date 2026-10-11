"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchLiveChats } from "@/services/supportOutreachApi.service";
import type { LiveChatSummary } from "@/types/supportOutreach.type";
import { formatRelativeTimeFromNow } from "@/utils/formatting.util";

import { LiveChatPanel } from "./liveChatPanel";

const tabs = [{ key: "OPEN", label: "Open" }, { key: "ENDED", label: "Ended" }] as const;

const columns: readonly DataTableColumn<LiveChatSummary>[] = [
  { key: "user", header: "Customer", render: (chat) => <UserIdentity user={chat.user} size={24} /> },
  { key: "topic", header: "Topic", render: (chat) => chat.topic },
  { key: "last", header: "Last message", render: (chat) => chat.lastMessagePreview },
  { key: "agent", header: "Agent", render: (chat) => chat.assignee?.name ?? "Unassigned" },
  { key: "status", header: "Status", render: (chat) => <StatusBadge status={chat.status} tone={chat.status === "WAITING" ? "danger" : undefined} /> },
  { key: "when", header: "Updated", render: (chat) => formatRelativeTimeFromNow(chat.lastMessageAt) },
];

export function LiveChatWorkspace() {
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("OPEN");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => fetchLiveChats({ status: tab }, signal), tab);
  return (
    <>
      <PageHeader area="Support" title="Live chat" description="Talk to people in real time. Chats are recorded and kept for review, and they are not end-to-end encrypted." />
      <SegmentedTabs label="Chat status" items={tabs} activeKey={tab} onChange={setTab} />
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      <DataTable caption="Live chats" columns={columns} rows={data?.items ?? []} readRowKey={(chat) => chat.id} onRowOpen={(chat) => setSelectedId(chat.id)} selectedRowKey={selectedId} isLoading={isLoading} emptyMessage="No chats right now." />
      {selectedId ? <LiveChatPanel key={selectedId} chatId={selectedId} onClose={() => setSelectedId(null)} onChanged={reload} /> : null}
    </>
  );
}
