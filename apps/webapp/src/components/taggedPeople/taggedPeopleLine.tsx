"use client";

import { useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { PersonTagIcon } from "@/components/ui/icons";
import type { Post } from "@/types";
import { formatTaggedPeopleSummary } from "@/utils/formatCount.util";

import styles from "./taggedPeople.module.css";
import { countTaggedPeople, TaggedPeopleList } from "./taggedPeopleList";

export function TaggedPeopleLine({ post }: { readonly post: Pick<Post, "id" | "taggedUsers" | "taggedUsersCount"> }) {
  const [isOpen, setIsOpen] = useState(false);
  const first = post.taggedUsers?.[0];
  const total = countTaggedPeople(post);
  if (!first || total === 0) return null;
  const summary = formatTaggedPeopleSummary(first.displayName, total);
  return (
    <>
      <button type="button" className={styles.line} aria-label={`Tagged: ${summary}`} aria-haspopup="dialog" onClick={() => setIsOpen(true)}>
        <PersonTagIcon size={16} />
        <span className={styles.truncate}>{summary}</span>
      </button>
      <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)} title="Tagged in this post" layout="sheet" size="small" showCloseButton icon={<PersonTagIcon size={24} />}>
        <TaggedPeopleList post={post} isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </Dialog>
    </>
  );
}
