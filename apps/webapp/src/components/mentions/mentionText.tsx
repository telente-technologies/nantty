"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";

import { showToast } from "@/components/ui/toast";
import { mentionsService } from "@/services/mentions.service";
import { isUserMentionEntity, type MentionEntity } from "@/types/mentions.type";
import { splitTextByTags } from "@/utils/usernameTags.util";

import styles from "./mentions.module.css";

function useResolvedMentionedUsers(mentions: readonly MentionEntity[] | undefined) {
  const userIds = [...new Set((mentions ?? []).filter(isUserMentionEntity).map((mention) => mention.userId))].sort();
  return useQuery({
    queryKey: ["mentionResolve", userIds.join(",")],
    queryFn: () => mentionsService.resolveMentionedUsers(userIds),
    enabled: userIds.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function MentionText({ text, mentions }: { readonly text: string; readonly mentions?: readonly MentionEntity[] }) {
  const resolvedQuery = useResolvedMentionedUsers(mentions);
  const segments = useMemo(() => splitTextByTags(text, (mentions ?? []).filter((mention) => mention.start >= 0 && mention.length > 1 && mention.start + mention.length <= text.length && text[mention.start] === "@")), [text, mentions]);
  return (
    <>
      {segments.map((segment, index) => {
        const mention = segment.entity;
        if (segment.username) {
          return (
            <Link key={index} href={`/${segment.username}`} className={styles.mention}>
              {segment.text}
            </Link>
          );
        }
        if (!mention) return <span key={index}>{segment.text}</span>;
        if (!isUserMentionEntity(mention)) {
          return (
            <span key={index} className={styles.everyonePill}>
              {segment.text}
            </span>
          );
        }
        const resolved = resolvedQuery.data?.[mention.userId];
        if (resolved?.status === "suspended") return <span key={index}>{segment.text}</span>;
        if (resolved?.status === "deleted") {
          return (
            <button key={index} type="button" className={styles.mentionButton} onClick={() => showToast({ text: "User not found" })}>
              {segment.text}
            </button>
          );
        }
        return (
          <Link key={index} href={`/user/${mention.userId}`} className={styles.mention}>
            {resolved?.username ? `@${resolved.username}` : segment.text}
          </Link>
        );
      })}
    </>
  );
}
