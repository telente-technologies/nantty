import { forbidden, notFound } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { blockRepository } from "../../blocks/repositories/block.repository.js";
import { followRepository } from "../../follows/repositories/follow.repository.js";
import { filterAuthorsVisibleToViewer } from "../../follows/services/profileAccess.service.js";
import { postRepository, type PostRow } from "../repositories/post.repository.js";
import { canViewerSeePostByAudience } from "./postRules.service.js";
import { isPostWithheldFromViewer, labelsWithheldFromAgeBracket } from "./sensitiveContent.service.js";
import { currentViewerAgeBracket } from "../../../utils/viewerAgeContext.util.js";

export async function loadPostVisibleToViewer(context: HandlerContext, viewerId: string | undefined, postId: string): Promise<PostRow> {
  const db = context.database.client;
  const post = await postRepository.findById(db, postId);
  if (post === null || (post.expiresAt !== null && post.expiresAt <= context.clock.now())) throw notFound("POST_NOT_FOUND", "Post not found.");
  if (isPostWithheldFromViewer(post, { viewerId, withheldLabels: labelsWithheldFromAgeBracket(currentViewerAgeBracket()) })) throw notFound("POST_NOT_AVAILABLE", "This post isn't available.");
  const authorVisible = await filterAuthorsVisibleToViewer(context, viewerId, [post.authorId]);
  if (!authorVisible.has(post.authorId)) {
    if (viewerId !== undefined && (await blockRepository.eitherDirection(db, viewerId, post.authorId))) throw notFound("POST_NOT_FOUND", "Post not found.");
    throw forbidden("ACCOUNT_PRIVATE", "This account is private");
  }
  const viewerFollowsAuthor = viewerId !== undefined && (await followRepository.find(db, viewerId, post.authorId))?.state === "accepted";
  if (!canViewerSeePostByAudience({ audience: post.audience, viewerId, authorId: post.authorId, viewerFollowsAuthor })) {
    throw forbidden("POST_FOLLOWERS_ONLY", "Only followers can see this post.");
  }
  return post;
}
