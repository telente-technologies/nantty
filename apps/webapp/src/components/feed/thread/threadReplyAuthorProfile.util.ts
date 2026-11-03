import type { ThreadReply } from "@/types/postThread.type";

export function threadReplyAuthorProfileHref(authorUsername: string, postedAs: ThreadReply["postedAs"]): string | null {
  return postedAs ? null : `/${authorUsername}`;
}
