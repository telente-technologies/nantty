import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";
import { followRepository } from "../../follows/repositories/follow.repository.js";
import type { MentionEntity } from "../../mentions/models/mention.model.js";
import { savedItemRepository } from "../../saves/repositories/savedItem.repository.js";
import type { LinkPreviewView } from "../../linkPreviews/models/linkPreview.model.js";
import type { MediaView, PostView, ReplyToComment, StickerLayout } from "../models/post.model.js";
import type { SoundView } from "../../sounds/models/sound.model.js";
import { buildSoundViews } from "../../sounds/services/soundView.service.js";
import { postRepository, type PostRow } from "../repositories/post.repository.js";
import { authorsFollowingViewer, decideReplyPermission, mentionedUserIdsFromEntities } from "./replyPolicy.service.js";
import { buildSensitiveContentView, isPostWithheldFromViewer, resolveCurrentViewerContentPolicy, type ViewerContentPolicy } from "./sensitiveContent.service.js";

type MediaRow = PostRow["media"][number];

export function toMediaView(row: MediaRow): MediaView {
  return {
    id: row.mediaId,
    type: row.type,
    url: row.url,
    posterUrl: row.posterUrl,
    hlsUrl: row.hlsUrl,
    ...(row.width === null ? {} : { width: row.width }),
    ...(row.height === null ? {} : { height: row.height }),
    ...(row.durationSeconds === null ? {} : { durationSeconds: row.durationSeconds }),
    blurhash: row.blurhash,
    status: row.status,
  };
}

const placeholderAuthor = (id: string): UserSummary => ({ id, name: "", username: "", avatarUrl: null, verified: false, isCreator: false });

export async function buildPostViews(context: HandlerContext, viewerId: string | undefined, candidateRows: readonly PostRow[], suppliedPolicy?: ViewerContentPolicy): Promise<PostView[]> {
  if (candidateRows.length === 0) return [];
  const db = context.database.client;
  const policy = suppliedPolicy ?? (await resolveCurrentViewerContentPolicy(context, viewerId));
  const rows = candidateRows.filter((row) => !isPostWithheldFromViewer(row, policy));
  if (rows.length === 0) return [];
  const originalIds = [...new Set(rows.flatMap((row) => (row.resharedFromId === null ? [] : [row.resharedFromId])))];
  const originals = originalIds.length === 0 ? [] : (await postRepository.findManyByIds(db, originalIds)).filter((row) => !isPostWithheldFromViewer(row, policy));
  const everyRow = [...rows, ...originals];
  const postIds = everyRow.map((row) => row.id);
  const authorIds = [...new Set(everyRow.map((row) => row.authorId))];
  const [authors, liked, saved, followed, followingViewer] = await Promise.all([
    context.directory.findUserSummaries(authorIds),
    viewerId === undefined ? new Set<string>() : postRepository.likedPostIds(db, viewerId, postIds),
    viewerId === undefined ? new Set<string>() : savedItemRepository.savedTargetIds(db, viewerId, postIds),
    viewerId === undefined ? new Set<string>() : followRepository.followedAccountIds(db, viewerId, authorIds),
    viewerId === undefined || !rows.some((row) => row.replyPolicy === "following") ? new Set<string>() : authorsFollowingViewer(context, viewerId, authorIds),
  ]);
  const soundIds = [...new Set(rows.flatMap((row) => (row.soundId === null ? [] : [row.soundId])))];
  const soundRows = soundIds.length === 0 ? [] : await db.sound.findMany({ where: { id: { in: soundIds } } });
  const sounds = new Map((await buildSoundViews(context, viewerId, soundRows)).map((sound) => [sound.id, sound]));
  const subscribed = new Map<string, boolean>();
  for (const row of everyRow) {
    if (row.visibility === "subscribers" && viewerId !== undefined && viewerId !== row.authorId && !subscribed.has(row.authorId)) {
      subscribed.set(row.authorId, await context.premium.hasSubscribedToCreator(viewerId, row.authorId));
    }
  }
  const viewsById = new Map<string, PostView>();
  const toView = (row: PostRow, embedded: boolean): PostView => {
    const subscriberOnly = row.visibility === "subscribers";
    const hasAccess = !subscriberOnly || viewerId === row.authorId || subscribed.get(row.authorId) === true;
    const original = embedded || row.resharedFromId === null ? undefined : originals.find((candidate) => candidate.id === row.resharedFromId);
    const replyPermission = decideReplyPermission({
      policy: row.replyPolicy, viewerId, authorId: row.authorId, viewerFollowsAuthor: followed.has(row.authorId), authorFollowsViewer: followingViewer.has(row.authorId),
      mentionedUserIds: mentionedUserIdsFromEntities(row.mentions), subscriberOnly, viewerHasSubscriberAccess: hasAccess,
    });
    return {
      id: row.id,
      kind: row.kind === "clip" ? "clip" : "post",
      author: authors.get(row.authorId) ?? placeholderAuthor(row.authorId),
      createdAt: row.createdAt.toISOString(),
      text: hasAccess ? row.text : "",
      media: hasAccess ? row.media.map(toMediaView) : [],
      likes: row.likeCount,
      comments: row.commentCount,
      reposts: row.repostCount,
      views: row.viewCount,
      liked: liked.has(row.id),
      bookmarked: saved.has(row.id),
      isSaved: saved.has(row.id),
      saveCount: row.saveCount,
      isFollowingAuthor: followed.has(row.authorId),
      friendsLiked: null,
      products: [],
      sponsored: null,
      subscriberOnly,
      viewerHasAccess: hasAccess,
      resharedFrom: original === undefined ? null : toView(original, true),
      resharedFromUnavailable: !embedded && row.resharedFromId !== null && original === undefined,
      isQuote: row.isQuote,
      quotes: row.quoteCount,
      replyPolicy: row.replyPolicy,
      viewerCanReply: replyPermission.allowed,
      replyRestriction: replyPermission.allowed ? null : { reason: replyPermission.reason, message: replyPermission.message },
      sensitive: buildSensitiveContentView(row, policy),
      isAiGenerated: row.isAiGenerated,
      ...(row.soundId === null || sounds.get(row.soundId) === undefined ? {} : { sound: sounds.get(row.soundId) as SoundView }),
      mentions: row.mentions as unknown as MentionEntity[],
      linkPreview: hasAccess && row.media.length === 0 && row.linkPreview !== null ? (row.linkPreview as unknown as LinkPreviewView) : null,
      ...(row.replyToCommentId === null || row.replyToClipId === null || row.replyToCommenterId === null
        ? {}
        : { replyToComment: { commentId: row.replyToCommentId, clipId: row.replyToClipId, commenterUserId: row.replyToCommenterId } satisfies ReplyToComment }),
      ...(row.stickerLayout === null ? {} : { stickerLayout: row.stickerLayout as unknown as StickerLayout }),
    };
  };
  for (const row of rows) viewsById.set(row.id, toView(row, false));
  return rows.map((row) => viewsById.get(row.id) as PostView);
}
