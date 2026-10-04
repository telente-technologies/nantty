import type { ReplyPolicy } from "../../../generated/prisma/client.js";
import { forbidden } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { followRepository } from "../../follows/repositories/follow.repository.js";
import type { MentionEntity } from "../../mentions/models/mention.model.js";

export const replyPolicies = ["everyone", "following", "followers", "mentioned", "off"] as const satisfies readonly ReplyPolicy[];

export type ReplyRestrictionReason = "SIGN_IN_REQUIRED" | "REPLIES_OFF" | "AUTHOR_FOLLOWS_ONLY" | "FOLLOWERS_ONLY" | "MENTIONED_ONLY" | "SUBSCRIBERS_ONLY";

export interface ReplyPermissionInput {
  readonly policy: ReplyPolicy;
  readonly viewerId: string | undefined;
  readonly authorId: string;
  readonly viewerFollowsAuthor: boolean;
  readonly authorFollowsViewer: boolean;
  readonly mentionedUserIds: readonly string[];
  readonly subscriberOnly: boolean;
  readonly viewerHasSubscriberAccess: boolean;
}

export type ReplyPermission = { readonly allowed: true } | { readonly allowed: false; readonly reason: ReplyRestrictionReason; readonly message: string };

const restrictionMessages: Readonly<Record<ReplyRestrictionReason, string>> = {
  SIGN_IN_REQUIRED: "Sign in to reply.",
  REPLIES_OFF: "The author turned off replies for this post.",
  AUTHOR_FOLLOWS_ONLY: "Only people the author follows can reply.",
  FOLLOWERS_ONLY: "Only the author's followers can reply.",
  MENTIONED_ONLY: "Only people mentioned in this post can reply.",
  SUBSCRIBERS_ONLY: "Only subscribers can reply to this post.",
};

const denied = (reason: ReplyRestrictionReason): ReplyPermission => ({ allowed: false, reason, message: restrictionMessages[reason] });

export function decideReplyPermission(input: ReplyPermissionInput): ReplyPermission {
  if (input.viewerId !== undefined && input.viewerId === input.authorId) return { allowed: true };
  if (input.policy === "off") return denied("REPLIES_OFF");
  if (input.viewerId === undefined) return denied("SIGN_IN_REQUIRED");
  if (input.subscriberOnly && !input.viewerHasSubscriberAccess) return denied("SUBSCRIBERS_ONLY");
  if (input.policy === "following" && !input.authorFollowsViewer) return denied("AUTHOR_FOLLOWS_ONLY");
  if (input.policy === "followers" && !input.viewerFollowsAuthor) return denied("FOLLOWERS_ONLY");
  if (input.policy === "mentioned" && !input.mentionedUserIds.includes(input.viewerId)) return denied("MENTIONED_ONLY");
  return { allowed: true };
}

export function mentionedUserIdsFromEntities(mentions: unknown): string[] {
  if (!Array.isArray(mentions)) return [];
  return (mentions as MentionEntity[]).flatMap((entity) => ("userId" in entity && typeof entity.userId === "string" ? [entity.userId] : []));
}

export async function authorsFollowingViewer(context: HandlerContext, viewerId: string, authorIds: readonly string[]): Promise<ReadonlySet<string>> {
  if (authorIds.length === 0) return new Set();
  const rows = await context.database.client.follow.findMany({ where: { followeeId: viewerId, state: "accepted", followerId: { in: [...authorIds] } }, select: { followerId: true } });
  return new Set(rows.map((row) => row.followerId));
}

export interface ReplyablePost {
  readonly authorId: string;
  readonly replyPolicy: ReplyPolicy;
  readonly visibility: "public" | "subscribers";
  readonly mentions: unknown;
}

export async function evaluateReplyPermissionForViewer(context: HandlerContext, viewerId: string | undefined, post: ReplyablePost): Promise<ReplyPermission> {
  if (viewerId === undefined || viewerId === post.authorId || post.replyPolicy === "off") {
    return decideReplyPermission({ policy: post.replyPolicy, viewerId, authorId: post.authorId, viewerFollowsAuthor: false, authorFollowsViewer: false, mentionedUserIds: [], subscriberOnly: false, viewerHasSubscriberAccess: false });
  }
  const db = context.database.client;
  const [viewerFollow, authorFollow, subscribed] = await Promise.all([
    post.replyPolicy === "followers" ? followRepository.find(db, viewerId, post.authorId) : null,
    post.replyPolicy === "following" ? followRepository.find(db, post.authorId, viewerId) : null,
    post.visibility === "subscribers" ? context.premium.hasSubscribedToCreator(viewerId, post.authorId) : true,
  ]);
  return decideReplyPermission({
    policy: post.replyPolicy,
    viewerId,
    authorId: post.authorId,
    viewerFollowsAuthor: viewerFollow?.state === "accepted",
    authorFollowsViewer: authorFollow?.state === "accepted",
    mentionedUserIds: mentionedUserIdsFromEntities(post.mentions),
    subscriberOnly: post.visibility === "subscribers",
    viewerHasSubscriberAccess: subscribed,
  });
}

export async function assertViewerMayReplyToPost(context: HandlerContext, viewerId: string, post: ReplyablePost): Promise<void> {
  const permission = await evaluateReplyPermissionForViewer(context, viewerId, post);
  if (!permission.allowed) throw forbidden(permission.reason, permission.message);
}
