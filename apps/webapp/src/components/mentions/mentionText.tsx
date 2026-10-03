"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { showToast } from "@/components/ui/toast";
import { mentionsService } from "@/services/mentions.service";
import { isUserMentionEntity, type MentionEntity } from "@/types/mentions.type";
import { splitTextIntoMentionSegments } from "@/utils/mentions.util";

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
  return (
    <>
      {splitTextIntoMentionSegments(text, mentions).map((segment, index) => {
        const mention = segment.mention;
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
