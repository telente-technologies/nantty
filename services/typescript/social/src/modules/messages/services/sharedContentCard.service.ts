import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { followRepository } from "../../follows/repositories/follow.repository.js";
import { filterAuthorsVisibleToViewer } from "../../follows/services/profileAccess.service.js";
import { postRepository } from "../../posts/repositories/post.repository.js";
import type { SharedContentCard, SharedContentReference } from "../models/message.model.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const unavailable = (reference: SharedContentReference): SharedContentCard => ({ reference, availability: "unavailable", title: null, subtitle: null, imageUrl: null, isLive: false, followsAuthor: null, profileUserId: null });

export async function buildSharedContentCard(context: HandlerContext, viewerId: string, reference: SharedContentReference): Promise<SharedContentCard> {
  const db = context.database.client;
  if (reference.kind === "profile") {
    const user = (await context.directory.findUserSummaries([reference.id])).get(reference.id);
    if (user === undefined) return unavailable(reference);
    return { reference, availability: "available", title: user.name, subtitle: `@${user.username}`, imageUrl: user.avatarUrl, isLive: false, followsAuthor: null, profileUserId: user.id };
  }
  if (reference.kind === "product" || reference.kind === "store" || reference.kind === "live" || reference.kind === "space" || reference.kind === "order") {
    const external = await context.shareCards?.resolve(reference.kind, reference.id, viewerId);
    if (external === null || external === undefined) return unavailable(reference);
    return { ...unavailable(reference), ...external, reference, isLive: external.isLive ?? false };
  }
  if (reference.kind === "story" && uuidPattern.test(reference.id)) return buildStoryCard(context, viewerId, reference);
  if ((reference.kind !== "post" && reference.kind !== "clip") || !uuidPattern.test(reference.id)) return unavailable(reference);
  const post = await postRepository.findById(db, reference.id);
  if (post === null) return unavailable(reference);
  const visible = await filterAuthorsVisibleToViewer(context, viewerId, [post.authorId]);
  if (!visible.has(post.authorId)) return { ...unavailable(reference), availability: "private" };
  const [author, follow] = await Promise.all([context.directory.findUserSummaries([post.authorId]), followRepository.find(db, viewerId, post.authorId)]);
  const media = post.media[0];
  return {
    reference, availability: "available", title: post.text === "" ? null : post.text.slice(0, 80), subtitle: author.get(post.authorId) === undefined ? null : `@${author.get(post.authorId)?.username}`,
    imageUrl: media?.posterUrl ?? media?.url ?? null, isLive: false, followsAuthor: follow?.state === "accepted", profileUserId: post.authorId,
  };
}

async function buildStoryCard(context: HandlerContext, viewerId: string, reference: SharedContentReference): Promise<SharedContentCard> {
  const story = await postRepository.findById(context.database.client, reference.id);
  if (story === null || story.kind !== "story" || (story.expiresAt !== null && story.expiresAt <= context.clock.now())) return unavailable(reference);
  const visible = await filterAuthorsVisibleToViewer(context, viewerId, [story.authorId]);
  if (!visible.has(story.authorId)) return { ...unavailable(reference), availability: "private" };
  const author = (await context.directory.findUserSummaries([story.authorId])).get(story.authorId);
  const media = story.media[0];
  return { reference, availability: "available", title: "Story", subtitle: author === undefined ? null : `@${author.username}`, imageUrl: media?.posterUrl ?? media?.url ?? null, isLive: false, followsAuthor: null, profileUserId: story.authorId };
}
