import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { mentionsService } from "@/services/content/mentions.service";
import type { MentionEntity, MentionTargetsByUserId } from "@/types/mention.type";
import { isUserMention } from "@/utils/mentions.util";

const MENTION_TARGETS_STALE_MS = 60_000;

export function useMentionTargets(mentions: readonly MentionEntity[] | undefined): MentionTargetsByUserId | undefined {
  const mentionedUserIds = useMemo(
    () => [...new Set((mentions ?? []).filter(isUserMention).map((entity) => entity.userId))].sort(),
    [mentions],
  );
  return useQuery({
    queryKey: ["mention-targets", mentionedUserIds.join(",")],
    queryFn: () => mentionsService.resolveMentionTargets(mentionedUserIds),
    enabled: mentionedUserIds.length > 0,
    staleTime: MENTION_TARGETS_STALE_MS,
  }).data;
}
