import type { LinkPreview } from "@/types";
import type { MentionEntity } from "@/types/mention.type";

export type OfflineMutation =
  | { readonly kind: "likePost"; readonly payload: { readonly postId: string } }
  | { readonly kind: "unlikePost"; readonly payload: { readonly postId: string } }
  | { readonly kind: "followUser"; readonly payload: { readonly userId: string } }
  | { readonly kind: "unfollowUser"; readonly payload: { readonly userId: string } }
  | {
      readonly kind: "sendMessage";
      readonly payload: { readonly conversationId: string; readonly text: string; readonly localMessageId: string; readonly linkPreview?: LinkPreview | null; readonly mentions?: readonly MentionEntity[] };
    };

export type OfflineMutationKind = OfflineMutation["kind"];

export type QueuedOfflineMutation = OfflineMutation & {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly attempts: number;
};

const OPPOSITE_MUTATION_KIND: Partial<Record<OfflineMutationKind, OfflineMutationKind>> = {
  likePost: "unlikePost",
  unlikePost: "likePost",
  followUser: "unfollowUser",
  unfollowUser: "followUser",
};

const describeMutationTarget = (mutation: OfflineMutation) => {
  if (mutation.kind === "likePost" || mutation.kind === "unlikePost") return `post:${mutation.payload.postId}`;
  if (mutation.kind === "followUser" || mutation.kind === "unfollowUser") return `user:${mutation.payload.userId}`;
  return `message:${mutation.payload.localMessageId}`;
};

export function addMutationToQueueCancellingOppositeToggles(
  queue: readonly QueuedOfflineMutation[],
  incoming: QueuedOfflineMutation,
): QueuedOfflineMutation[] {
  const incomingTarget = describeMutationTarget(incoming);
  const oppositeKind = OPPOSITE_MUTATION_KIND[incoming.kind];
  const pendingOpposite = queue.find(
    (queued) => queued.kind === oppositeKind && queued.attempts === 0 && describeMutationTarget(queued) === incomingTarget,
  );
  if (pendingOpposite) return queue.filter((queued) => queued.id !== pendingOpposite.id);
  const alreadyQueued = queue.some((queued) => queued.kind === incoming.kind && describeMutationTarget(queued) === incomingTarget);
  return alreadyQueued ? [...queue] : [...queue, incoming];
}
