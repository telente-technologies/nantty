"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ErrorBlock, InlineError, LoadingBlock } from "@/components/ui/feedback";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { IconLabel } from "@/components/ui/zudoIcon";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { createHelpTopic, fetchHelpCategories, fetchHelpTopic, fetchHelpTopics, updateHelpTopic } from "@/services/helpContentApi.service";
import type { HelpTopicDetail, HelpTopicInput } from "@/types/helpContent.type";
import { humanizeConstantName } from "@/utils/formatting.util";

import styles from "./helpContent.module.css";
import { HelpMarkdownPreview } from "./helpMarkdownPreview";
import { HelpTopicLifecycleCard } from "./helpTopicLifecycleCard";

interface EditorForm {
  categoryId: string;
  slug: string;
  title: string;
  summary: string;
  tags: string;
  bodyMarkdown: string;
  relatedTopicIds: string[];
  changeNote: string;
}

function formFromDetail(detail: HelpTopicDetail | null): EditorForm {
  if (!detail) return { categoryId: "", slug: "", title: "", summary: "", tags: "", bodyMarkdown: "## The answer\n\n", relatedTopicIds: [], changeNote: "" };
  const { topic } = detail;
  return { categoryId: topic.categoryId, slug: topic.slug, title: topic.title, summary: topic.summary, tags: topic.tags.join(", "), bodyMarkdown: topic.bodyMarkdown, relatedTopicIds: [...detail.relatedTopicIds], changeNote: "" };
}

function EditorBody({ detail, onSaved }: { readonly detail: HelpTopicDetail | null; readonly onSaved: (detail: HelpTopicDetail | null, topicId: string) => void }) {
  const { can } = useAdminPermissions();
  const canEdit = can("support:helpContent");
  const { showToast } = useToast();
  const [form, setForm] = useState<EditorForm>(() => formFromDetail(detail));
  const [relatedSearch, setRelatedSearch] = useState("");
  const categories = useAdminQuery((signal) => fetchHelpCategories(signal), "editor-categories");
  const candidates = useAdminQuery((signal) => fetchHelpTopics({ status: "PUBLISHED", search: relatedSearch.trim(), pageSize: 50 }, signal), `related:${relatedSearch}`);
  const save = useAdminMutation((input: HelpTopicInput) => (detail ? updateHelpTopic(detail.topic.id, input) : createHelpTopic(input)));
  const update = (patch: Partial<EditorForm>) => setForm((current) => ({ ...current, ...patch }));
  const relatedChoices = useMemo(() => (candidates.data?.items ?? []).filter((topic) => topic.id !== detail?.topic.id), [candidates.data, detail]);

  async function submit(status: "DRAFT" | "PUBLISHED" | undefined, event?: FormEvent) {
    event?.preventDefault();
    const saved = await save.run({
      categoryId: form.categoryId, title: form.title.trim(), summary: form.summary.trim() || undefined, bodyMarkdown: form.bodyMarkdown,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean), relatedTopicIds: form.relatedTopicIds, status,
      ...(form.slug.trim() ? { slug: form.slug.trim() } : {}), ...(form.changeNote.trim() ? { changeNote: form.changeNote.trim() } : {}),
    });
    if (!saved) return;
    showToast(status === "PUBLISHED" ? "Topic saved and published" : "Topic saved");
    onSaved(detail, saved.id);
  }

  const categoryOptions = [{ value: "", label: "Choose a category" }, ...(categories.data?.items ?? []).map((category) => ({ value: category.id, label: category.title }))];
  return (
    <form className={styles.stack} onSubmit={(event) => void submit(undefined, event)}>
      <Card title="Topic">
        <div className={styles.stack}>
          <SelectField label="Category" options={categoryOptions} value={form.categoryId} onChange={(event) => update({ categoryId: event.target.value })} required disabled={!canEdit} />
          <TextField label="Title" value={form.title} onChange={(event) => update({ title: event.target.value })} required minLength={5} maxLength={140} disabled={!canEdit} />
          <TextField label="Address" hint="Leave empty to create it from the title. Lowercase words joined by dashes." value={form.slug} onChange={(event) => update({ slug: event.target.value })} pattern="[a-z0-9]+(-[a-z0-9]+)*" disabled={!canEdit} />
          <TextField label="Summary" hint="One sentence shown in search results and link previews." value={form.summary} onChange={(event) => update({ summary: event.target.value })} maxLength={300} disabled={!canEdit} />
          <TextField label="Tags" hint="Comma separated, helps search." value={form.tags} onChange={(event) => update({ tags: event.target.value })} disabled={!canEdit} />
        </div>
      </Card>
      <div className={styles.editorGrid}>
        <TextAreaField label="Body (Markdown)" hint="Use ## headings, lists, **bold** and [links](/help/category/topic). Raw HTML and scripts are rejected." value={form.bodyMarkdown} onChange={(event) => update({ bodyMarkdown: event.target.value })} rows={22} maxLength={40_000} disabled={!canEdit} />
        <div className={styles.stack}>
          <strong>Preview</strong>
          <HelpMarkdownPreview markdown={form.bodyMarkdown} />
        </div>
      </div>
      <Card title="Related topics">
        <div className={styles.stack}>
          <TextField label="Find topics" isLabelHidden placeholder="Search published topics" value={relatedSearch} onChange={(event) => setRelatedSearch(event.target.value)} />
          <div className={styles.relatedList}>
            {relatedChoices.map((topic) => (
              <CheckboxField
                key={topic.id}
                label={topic.title}
                description={topic.categoryTitle}
                checked={form.relatedTopicIds.includes(topic.id)}
                disabled={!canEdit || (!form.relatedTopicIds.includes(topic.id) && form.relatedTopicIds.length >= 8)}
                onChange={(event) => update({ relatedTopicIds: event.target.checked ? [...form.relatedTopicIds, topic.id] : form.relatedTopicIds.filter((id) => id !== topic.id) })}
              />
            ))}
          </div>
          <span className={styles.muted}>{form.relatedTopicIds.length} of 8 selected</span>
        </div>
      </Card>
      {canEdit ? (
        <>
          {detail ? <TextField label="Change note" hint="Saved in the version history." value={form.changeNote} onChange={(event) => update({ changeNote: event.target.value })} maxLength={200} /> : null}
          {save.errorMessage ? <InlineError message={save.errorMessage} /> : null}
          <div className={styles.row}>
            <Button type="submit" isBusy={save.isRunning} disabled={!form.categoryId || form.title.trim().length < 5}>{detail ? "Save" : "Save as draft"}</Button>
            <Button type="button" variant="primary" isBusy={save.isRunning} disabled={!form.categoryId || form.title.trim().length < 5} onClick={() => void submit("PUBLISHED")}>Save and publish</Button>
          </div>
        </>
      ) : null}
    </form>
  );
}

export function HelpTopicEditor({ topicId }: { readonly topicId: string | null }) {
  const router = useRouter();
  const topic = useAdminQuery((signal) => fetchHelpTopic(topicId ?? "", signal), topicId ?? "new", topicId !== null);
  if (topicId !== null && topic.errorMessage) return <ErrorBlock variant="section" error={topic.error} message={topic.errorMessage} onRetry={topic.reload} />;
  if (topicId !== null && (topic.isLoading || !topic.data)) return <LoadingBlock lines={10} label="Loading topic" />;
  const detail = topicId === null ? null : topic.data;
  return (
    <>
      <Link href="/support/help">
        <IconLabel name="arrowLeft24" size={16}>Help centre</IconLabel>
      </Link>
      <PageHeader
        area="Support · Help centre"
        title={detail ? detail.topic.title : "New topic"}
        meta={detail ? (
          <>
            <StatusBadge status={detail.topic.status} label={humanizeConstantName(detail.topic.status)} />
            {detail.topic.fromResolvedQuestion ? <span className={styles.sourceLabel}>From a resolved question</span> : null}
            <span className={styles.muted}>Version {detail.topic.version} · updated by {detail.topic.updatedByName}</span>
          </>
        ) : null}
      />
      <EditorBody key={detail ? `${detail.topic.id}:${detail.topic.version}:${detail.topic.status}` : "new"} detail={detail} onSaved={(previous, savedId) => (previous ? topic.reload() : router.replace(`/support/help/${encodeURIComponent(savedId)}`))} />
      {detail ? <HelpTopicLifecycleCard detail={detail} onChanged={topic.reload} /> : null}
    </>
  );
}
