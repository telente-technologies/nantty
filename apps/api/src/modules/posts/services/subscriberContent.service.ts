import type { CreatorSubscriberLookup } from "../../../interfaces/creatorSubscriberLookup.interface.js";
import type { PostDto } from "../dtos/posts.dto.js";

const LOCKED_PREVIEW_LENGTH = 80;

function collectLockCandidates(posts: readonly PostDto[], viewerId: string | undefined): Set<string> {
  const authorIds = new Set<string>();
  for (const post of [...posts, ...posts.map((item) => item.repostOf).filter((item): item is PostDto => item !== null)]) {
    const authorId = post.author?.id;
    if (post.visibility === "subscribers" && authorId !== undefined && authorId !== viewerId) authorIds.add(authorId);
  }
  return authorIds;
}

function lockPost(post: PostDto, unlockedAuthorIds: ReadonlySet<string>, viewerId: string | undefined): PostDto {
  const repostOf = post.repostOf === null ? null : lockPost(post.repostOf, unlockedAuthorIds, viewerId);
  const authorId = post.author?.id;
  const locked = post.visibility === "subscribers" && authorId !== viewerId && (authorId === undefined || !unlockedAuthorIds.has(authorId));
  if (!locked) return { ...post, repostOf };
  const preview = post.text.length > LOCKED_PREVIEW_LENGTH ? `${post.text.slice(0, LOCKED_PREVIEW_LENGTH)}…` : post.text;
  return { ...post, repostOf, locked: true, text: preview, media: [], lockedMediaCount: post.media.length, products: [] };
}

export async function lockSubscriberOnlyPosts(posts: readonly PostDto[], viewerId: string | undefined, lookup: CreatorSubscriberLookup | undefined): Promise<PostDto[]> {
  const candidates = collectLockCandidates(posts, viewerId);
  const unlocked = candidates.size === 0 || viewerId === undefined || lookup === undefined ? new Set<string>() : await lookup.listCreatorIdsViewerSubscribesTo(viewerId, [...candidates]);
  return posts.map((post) => lockPost(post, unlocked, viewerId));
}
