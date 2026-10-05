import type { SocialProofItem, SocialProofSelection } from "../../../interfaces/socialProof.interface.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { followRepository } from "../../follows/repositories/follow.repository.js";
import type { FriendsLikedView, PostView } from "../../posts/models/post.model.js";

const minimumFriends = 2;
const minimumGap = 5;
const maximumAvatars = 3;

export function selectSocialProofDeterministically(items: readonly SocialProofItem[]): SocialProofSelection[] {
  const selections: SocialProofSelection[] = [];
  let lastPosition = -Infinity;
  items.forEach((item, position) => {
    if (item.likedByFriendIds.length < minimumFriends || position - lastPosition < minimumGap) return;
    lastPosition = position;
    selections.push({ postId: item.postId, friendIds: item.likedByFriendIds.slice(0, maximumAvatars), totalFriendCount: item.likedByFriendIds.length });
  });
  return selections;
}

export async function attachFriendsLiked(context: HandlerContext, viewerId: string | undefined, views: readonly PostView[]): Promise<PostView[]> {
  if (viewerId === undefined || views.length === 0) return [...views];
  const db = context.database.client;
  const followed = await followRepository.allFollowedAccountIds(db, viewerId);
  if (followed.length === 0) return [...views];
  const likes = await db.postLike.findMany({ where: { postId: { in: views.map((view) => view.id) }, userId: { in: followed } }, select: { postId: true, userId: true }, orderBy: { createdAt: "desc" } });
  const likersByPost = new Map<string, string[]>();
  for (const like of likes) likersByPost.set(like.postId, [...(likersByPost.get(like.postId) ?? []), like.userId]);
  const items: SocialProofItem[] = views.map((view) => ({ postId: view.id, authorId: view.author.id, likedByFriendIds: likersByPost.get(view.id) ?? [] }));
  if (!items.some((item) => item.likedByFriendIds.length > 0)) return [...views];
  const selections = (await context.socialProof?.select(viewerId, followed, items)) ?? selectSocialProofDeterministically(items);
  if (selections.length === 0) return [...views];
  const summaries = await context.directory.findUserSummaries([...new Set(selections.flatMap((selection) => selection.friendIds))]);
  const bannerByPost = new Map<string, FriendsLikedView>(selections.map((selection) => [selection.postId, {
    count: selection.totalFriendCount,
    avatars: selection.friendIds.slice(0, maximumAvatars).map((friendId) => summaries.get(friendId)?.avatarUrl ?? null),
  }]));
  return views.map((view) => (bannerByPost.has(view.id) ? { ...view, friendsLiked: bannerByPost.get(view.id) as FriendsLikedView } : view));
}
