"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { InlineError } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { Card } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { deleteHelpTopic, fetchHelpTopics, mergeHelpTopic, publishHelpTopic, unpublishHelpTopic } from "@/services/helpContentApi.service";
import type { HelpTopicDetail } from "@/types/helpContent.type";
import { formatDateTime } from "@/utils/formatting.util";

import styles from "./helpContent.module.css";

export function HelpTopicLifecycleCard({ detail, onChanged }: { readonly detail: HelpTopicDetail; readonly onChanged: () => void }) {
  const router = useRouter();
  const { can } = useAdminPermissions();
  const canEdit = can("support:helpContent");
  const { showToast } = useToast();
  const { topic } = detail;
  const [targetSearch, setTargetSearch] = useState("");
  const [targetTopicId, setTargetTopicId] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const targets = useAdminQuery((signal) => fetchHelpTopics({ status: "PUBLISHED", search: targetSearch.trim(), pageSize: 30 }, signal), `merge:${targetSearch}`, canEdit && topic.status !== "MERGED");
  const statusChange = useAdminMutation((publish: boolean) => (publish ? publishHelpTopic(topic.id) : unpublishHelpTopic(topic.id)));
  const merge = useAdminMutation((target: string) => mergeHelpTopic(topic.id, target));
  const remove = useAdminMutation(() => deleteHelpTopic(topic.id));
  const isPublished = topic.status === "PUBLISHED";

  async function changeStatus(publish: boolean) {
    if (await statusChange.run(publish)) {
      showToast(publish ? "Topic published" : "Topic unpublished");
      onChanged();
    }
  }

  async function mergeInto() {
    const merged = await merge.run(targetTopicId);
    if (!merged) return;
    showToast(`Merged into ${merged.title}`);
    router.push(`/support/help/${encodeURIComponent(merged.id)}`);
  }

  const targetOptions = [{ value: "", label: "Choose a topic to merge into" }, ...(targets.data?.items ?? []).filter((candidate) => candidate.id !== topic.id).map((candidate) => ({ value: candidate.id, label: candidate.title }))];
  return (
    <>
      {canEdit && topic.status !== "MERGED" ? (
        <Card title="Publishing">
          <div className={styles.stack}>
            <div className={styles.row}>
              <Button variant={isPublished ? "secondary" : "primary"} isBusy={statusChange.isRunning} onClick={() => void changeStatus(!isPublished)}>{isPublished ? "Unpublish" : "Publish"}</Button>
              <Button variant="quietDanger" onClick={() => setIsDeleting(true)}>Delete topic</Button>
            </div>
            {statusChange.errorMessage ? <InlineError message={statusChange.errorMessage} /> : null}
            <strong>Merge into another topic</strong>
            <p className={styles.muted}>This topic is added to the other one as a Related question section and stops being shown on its own.</p>
            <TextField label="Find a topic" isLabelHidden placeholder="Search published topics" value={targetSearch} onChange={(event) => setTargetSearch(event.target.value)} />
            <div className={styles.row}>
              <SelectField label="Merge into" isLabelHidden options={targetOptions} value={targetTopicId} onChange={(event) => setTargetTopicId(event.target.value)} />
              <Button onClick={() => void mergeInto()} isBusy={merge.isRunning} disabled={!targetTopicId}>Merge</Button>
            </div>
            {merge.errorMessage ? <InlineError message={merge.errorMessage} /> : null}
          </div>
        </Card>
      ) : null}
      <Card title="Version history">
        <ol className={styles.stack}>
          {detail.versions.map((version) => (
            <li key={version.version}>
              <strong>Version {version.version}</strong> · {version.editedByName} · {formatDateTime(version.createdAt)}
              {version.changeNote ? <span className={styles.muted}> · {version.changeNote}</span> : null}
            </li>
          ))}
        </ol>
      </Card>
      <ConfirmActionDialog intent="delete"
        isOpen={isDeleting}
        title="Delete this topic?"
        description="It disappears from the Help Centre straight away and its history is deleted. Unpublish instead if you might need it again."
        confirmLabel="Delete topic"
        tone="danger"
        isBusy={remove.isRunning}
        errorMessage={remove.errorMessage}
        onClose={() => setIsDeleting(false)}
        onConfirm={async () => {
          if ((await remove.run(undefined)) !== null) {
            showToast("Topic deleted");
            router.push("/support/help");
          }
        }}
      />
    </>
  );
}
