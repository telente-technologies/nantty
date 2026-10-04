"use client";

import { Dialog } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/media";
import type { Post } from "@/types";
import { formatCompactCount, formatTaggedPeopleSummary } from "@/utils/formatCount.util";

import styles from "./taggedPeople.module.css";
import { countTaggedPeople, TaggedPeopleList } from "./taggedPeopleList";

interface ClipTaggedPillProps {
  readonly post: Pick<Post, "id" | "taggedUsers" | "taggedUsersCount">;
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
}

export function ClipTaggedPill({ post, isOpen, onOpenChange }: ClipTaggedPillProps) {
  const people = post.taggedUsers ?? [];
  const total = countTaggedPeople(post);
  if (people.length === 0 || total === 0) return null;
  const label = total === 1 ? people[0]!.displayName : `${formatCompactCount(total)} people`;
  return (
    <>
      <button type="button" className={styles.pill} aria-label={`Tagged: ${formatTaggedPeopleSummary(people[0]!.displayName, total)}`} aria-haspopup="dialog" onClick={() => onOpenChange(true)}>
        <span className={styles.stack} aria-hidden="true">
          {people.slice(0, 3).map((person) => (
            <span key={person.id} className={styles.stackItem}>
              <Avatar name={person.displayName} src={person.avatarUrl} size="xs" />
            </span>
          ))}
        </span>
        <span className={styles.truncate}>{label}</span>
      </button>
      <Dialog isOpen={isOpen} onClose={() => onOpenChange(false)} title="Tagged in this clip" description={`${formatCompactCount(total)} ${total === 1 ? "person" : "people"}`} layout="sheet" size="medium">
        <TaggedPeopleList post={post} isOpen={isOpen} onClose={() => onOpenChange(false)} />
      </Dialog>
    </>
  );
}
