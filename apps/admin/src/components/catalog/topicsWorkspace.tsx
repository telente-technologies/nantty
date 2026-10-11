"use client";

import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading, Toolbar } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchContentTopicWithHistory, fetchContentTopics } from "@/services/catalogApi.service";
import type { ContentTopic } from "@/types/catalog.type";
import { formatDateTime, formatWholeNumber } from "@/utils/formatting.util";

import { CatalogTabs } from "./catalogTabs";
import { TopicActionDialog, type TopicAction } from "./topicActionDialog";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "HIDDEN", label: "Hidden" },
];

const columns: DataTableColumn<ContentTopic>[] = [
  { key: "name", header: "Topic", render: (topic) => <strong>{topic.name}</strong> },
  { key: "slug", header: "Slug", isMono: true, render: (topic) => topic.slug },
  { key: "posts", header: "Posts", align: "end", render: (topic) => formatWholeNumber(topic.postCount) },
  { key: "followers", header: "Followers", align: "end", render: (topic) => formatWholeNumber(topic.followerCount, { compact: true }) },
  { key: "trending", header: "Trending", render: (topic) => (topic.isTrending ? <StatusBadge label="Trending" tone="brand" hasDot={false} /> : <span aria-label="Not trending">—</span>) },
  { key: "status", header: "Status", render: (topic) => <StatusBadge status={topic.status} /> },
];

export function TopicsWorkspace() {
  const { showToast } = useToast();
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<TopicAction | null>(null);
  const [changeCounter, setChangeCounter] = useState(0);
  const topics = useAdminQuery((signal) => fetchContentTopics({ search: searchText, status }, signal), `${searchText}|${status}|${changeCounter}`);
  const selectedTopic = topics.data?.items.find((topic) => topic.id === selectedTopicId) ?? null;
  const detail = useAdminQuery((signal) => fetchContentTopicWithHistory(selectedTopicId ?? "", signal), `${selectedTopicId}|${changeCounter}`, selectedTopicId !== null);

  return (
    <>
      <PageHeader area="Content" title="Categories & topics" description="Topics are the interests people follow and creators tag. The feed ranks with them; hidden topics stop influencing it." actions={<Button variant="primary" iconName="plus16" onClick={() => setPendingAction({ kind: "create" })}>Add topic</Button>} />
      <CatalogTabs />
      <Toolbar>
        <TextField label="Search topics" isLabelHidden placeholder="Search topics" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
        <SelectField label="Status" isLabelHidden options={statusOptions} value={status} onChange={(event) => setStatus(event.target.value)} />
      </Toolbar>
      {topics.errorMessage ? <ErrorBlock error={topics.error} message={topics.errorMessage} onRetry={topics.reload} /> : null}
      <DataTable caption="Content topics" columns={columns} rows={topics.data?.items ?? []} readRowKey={(topic) => topic.id} onRowOpen={(topic) => setSelectedTopicId(topic.id)} selectedRowKey={selectedTopicId} isLoading={topics.isLoading} emptyMessage="No topics match these filters." />
      {selectedTopic ? (
        <SidePanel
          isOpen
          title={selectedTopic.name}
          subtitle={<code>{selectedTopic.id}</code>}
          onClose={() => setSelectedTopicId(null)}
          footer={
            <>
              <Button onClick={() => setPendingAction({ kind: "rename", topic: selectedTopic })}>Rename</Button>
              <Button onClick={() => setPendingAction({ kind: "toggleTrending", topic: selectedTopic })} disabled={selectedTopic.status === "HIDDEN"}>
                {selectedTopic.isTrending ? "Remove from trending" : "Mark trending"}
              </Button>
              <Button variant={selectedTopic.status === "ACTIVE" ? "quietDanger" : "secondary"} onClick={() => setPendingAction({ kind: "toggleStatus", topic: selectedTopic })}>
                {selectedTopic.status === "ACTIVE" ? "Hide topic" : "Show topic"}
              </Button>
            </>
          }
        >
          <KeyValueList
            columns={2}
            items={[
              { label: "Status", value: <StatusBadge status={selectedTopic.status} /> },
              { label: "Trending", value: selectedTopic.isTrending ? "Yes" : "No" },
              { label: "Posts", value: formatWholeNumber(selectedTopic.postCount) },
              { label: "Followers", value: formatWholeNumber(selectedTopic.followerCount) },
              { label: "Slug", value: selectedTopic.slug, isMono: true },
              { label: "Last changed", value: formatDateTime(selectedTopic.updatedAt) },
            ]}
          />
          <SectionHeading>History</SectionHeading>
          {detail.isLoading && !detail.data ? <LoadingBlock lines={3} /> : null}
          {detail.errorMessage ? <ErrorBlock error={detail.error} message={detail.errorMessage} onRetry={detail.reload} /> : null}
          {detail.data ? <AuditHistoryList entries={detail.data.history} /> : null}
        </SidePanel>
      ) : null}
      {pendingAction ? (
        <TopicActionDialog
          action={pendingAction}
          onClose={() => setPendingAction(null)}
          onDone={(topic, message) => {
            setPendingAction(null);
            setSelectedTopicId(topic.id);
            setChangeCounter((current) => current + 1);
            showToast(message);
          }}
        />
      ) : null}
    </>
  );
}
