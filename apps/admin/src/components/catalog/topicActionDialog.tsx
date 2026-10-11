"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { TextField } from "@/components/ui/formFields";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { createContentTopic, updateContentTopic } from "@/services/catalogApi.service";
import type { ContentTopic } from "@/types/catalog.type";

export type TopicAction = { readonly kind: "create" } | { readonly kind: "rename" | "toggleStatus" | "toggleTrending"; readonly topic: ContentTopic };

function describeTopicAction(action: TopicAction) {
  if (action.kind === "create") return { title: "Add topic", confirmLabel: "Add topic", consequences: ["Creators can tag posts and clips with it; it appears in topic pickers right away."] };
  const { topic } = action;
  if (action.kind === "rename") return { title: `Rename ${topic.name}`, confirmLabel: "Rename topic", consequences: ["Posts keep the topic; people see the new name everywhere."] };
  if (action.kind === "toggleStatus") {
    return topic.status === "ACTIVE"
      ? { title: `Hide ${topic.name}?`, confirmLabel: "Hide topic", consequences: ["The topic disappears from pickers, search and the feed's interest signals.", "Existing posts stay up; only the tag is hidden.", "Trending is switched off."] }
      : { title: `Show ${topic.name} again?`, confirmLabel: "Show topic", consequences: ["The topic returns to pickers, search and feed signals."] };
  }
  return topic.isTrending
    ? { title: `Remove ${topic.name} from trending?`, confirmLabel: "Remove from trending", consequences: ["It stops appearing in the Trending row on Discover."] }
    : { title: `Mark ${topic.name} as trending?`, confirmLabel: "Mark trending", consequences: ["It is pinned to the Trending row on Discover for every country."] };
}

export function TopicActionDialog({ action, onClose, onDone }: { readonly action: TopicAction; readonly onClose: () => void; readonly onDone: (topic: ContentTopic, message: string) => void }) {
  const [name, setName] = useState(action.kind === "rename" ? action.topic.name : "");
  const description = describeTopicAction(action);
  const mutation = useAdminMutation((reason: string) => {
    if (action.kind === "create") return createContentTopic(name.trim(), reason);
    if (action.kind === "rename") return updateContentTopic(action.topic.id, { name: name.trim(), reason });
    if (action.kind === "toggleStatus") return updateContentTopic(action.topic.id, { status: action.topic.status === "ACTIVE" ? "HIDDEN" : "ACTIVE", reason });
    return updateContentTopic(action.topic.id, { isTrending: !action.topic.isTrending, reason });
  });
  const needsName = action.kind === "create" || action.kind === "rename";

  async function confirmAction(reason: string) {
    const result = await mutation.run(reason);
    if (!result) return;
    const doneMessages: Record<TopicAction["kind"], string> = { create: "added", rename: "renamed", toggleStatus: result.item.status === "HIDDEN" ? "hidden" : "shown again", toggleTrending: result.item.isTrending ? "marked trending" : "removed from trending" };
    onDone(result.item, `${result.item.name} ${doneMessages[action.kind]}`);
  }

  return (
    <ConfirmActionDialog intent="edit"
      isOpen
      title={description.title}
      consequences={description.consequences}
      confirmLabel={description.confirmLabel}
      tone={action.kind === "toggleStatus" && action.topic.status === "ACTIVE" ? "danger" : "default"}
      isBusy={mutation.isRunning}
      errorMessage={mutation.errorMessage}
      isConfirmDisabled={needsName && name.trim().length < 2}
      onConfirm={confirmAction}
      onClose={onClose}
    >
      {needsName ? <TextField label="Topic name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoFocus /> : null}
    </ConfirmActionDialog>
  );
}
