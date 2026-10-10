import type { Comment } from "@/types";

export function countRepliesHiddenFromChain(root: Pick<Comment, "id" | "replyCount">, chain: readonly Pick<Comment, "id" | "parentCommentId" | "replyCount">[]): number {
  const shownUnder = (parentId: string) => chain.filter((reply) => reply.parentCommentId === parentId).length;
  return [root, ...chain].reduce((hidden, node) => hidden + Math.max(0, node.replyCount - shownUnder(node.id)), 0);
}
