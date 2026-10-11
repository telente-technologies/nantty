"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchHelpCategories, fetchHelpTopics } from "@/services/helpContentApi.service";
import type { HelpTopic } from "@/types/helpContent.type";
import { formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./helpContent.module.css";

export const helpTopicStatusOptions = [
  { value: "", label: "Any status" },
  { value: "PUBLISHED", label: "Published" },
  { value: "PENDING_REVIEW", label: "Waiting for review" },
  { value: "DRAFT", label: "Draft" },
  { value: "UNPUBLISHED", label: "Unpublished" },
  { value: "MERGED", label: "Merged" },
];

const originOptions = [
  { value: "", label: "Any source" },
  { value: "RESOLVED_QUESTION", label: "From a resolved question" },
  { value: "EDITORIAL", label: "Written by staff" },
  { value: "SEED", label: "Starter content" },
];

const columns: DataTableColumn<HelpTopic>[] = [
  {
    key: "title",
    header: "Topic",
    render: (topic) => (
      <span className={styles.titleCell}>
        <strong>{topic.title}</strong>
        <span className={styles.muted}>/{topic.categorySlug}/{topic.slug}{topic.fromResolvedQuestion ? " · From a resolved question" : ""}</span>
      </span>
    ),
  },
  { key: "category", header: "Category", render: (topic) => topic.categoryTitle },
  { key: "status", header: "Status", render: (topic) => <StatusBadge status={topic.status} label={humanizeConstantName(topic.status)} /> },
  { key: "helpful", header: "Helpful", render: (topic) => `${topic.helpfulCount} / ${topic.helpfulCount + topic.notHelpfulCount}`, align: "end" },
  { key: "updated", header: "Updated", render: (topic) => <span className={styles.muted}>{formatRelativeTimeFromNow(topic.updatedAt)} · v{topic.version}</span> },
];

export function HelpTopicsPanel() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filters = { status, origin, categoryId, search: search.trim(), page };
  const topics = useAdminQuery((signal) => fetchHelpTopics(filters, signal), JSON.stringify(filters));
  const categories = useAdminQuery((signal) => fetchHelpCategories(signal), "help-categories");
  const categoryOptions = [{ value: "", label: "Any category" }, ...(categories.data?.items ?? []).map((category) => ({ value: category.id, label: category.title }))];
  const change = (apply: () => void) => {
    apply();
    setPage(1);
  };
  return (
    <>
      <Toolbar>
        <TextField label="Search topics" isLabelHidden placeholder="Search titles and text" value={search} onChange={(event) => change(() => setSearch(event.target.value))} />
        <SelectField label="Status" isLabelHidden options={helpTopicStatusOptions} value={status} onChange={(event) => change(() => setStatus(event.target.value))} />
        <SelectField label="Source" isLabelHidden options={originOptions} value={origin} onChange={(event) => change(() => setOrigin(event.target.value))} />
        <SelectField label="Category" isLabelHidden options={categoryOptions} value={categoryId} onChange={(event) => change(() => setCategoryId(event.target.value))} />
      </Toolbar>
      {topics.errorMessage ? <ErrorBlock error={topics.error} message={topics.errorMessage} onRetry={topics.reload} /> : null}
      <DataTable
        caption="Help topics"
        columns={columns}
        rows={topics.data?.items ?? []}
        readRowKey={(topic) => topic.id}
        onRowOpen={(topic) => router.push(`/support/help/${encodeURIComponent(topic.id)}`)}
        isLoading={topics.isLoading}
        readRowTone={(topic) => (topic.status === "PENDING_REVIEW" ? "caution" : null)}
        emptyMessage="No topics match these filters."
      />
      {topics.data ? <Pagination page={topics.data.page} pageSize={topics.data.pageSize} total={topics.data.total} onPageChange={setPage} /> : null}
    </>
  );
}
