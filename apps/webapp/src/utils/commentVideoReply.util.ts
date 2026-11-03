import type { CommentVideoReply } from "@/types";

export function commentVideoReplyHref(reply: Pick<CommentVideoReply, "clipId">): string {
  return `/videos/suggested?start=${encodeURIComponent(reply.clipId)}`;
}
