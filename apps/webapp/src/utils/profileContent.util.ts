import type { Post } from "@/types";

export type ProfileContentTab = "posts" | "clips" | "reposts" | "media";

export const profileContentTabOptions: readonly { readonly value: ProfileContentTab; readonly label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "clips", label: "Clips" },
  { value: "reposts", label: "Reposts" },
  { value: "media", label: "Media" },
];

export function filterPostsForProfileTab(posts: readonly Post[], tab: ProfileContentTab): readonly Post[] {
  if (tab === "clips") return posts.filter((post) => post.kind === "clip");
  if (tab === "reposts") return posts.filter((post) => post.isQuote === true || post.resharedFrom != null);
  return posts;
}

export function sortPinnedPostsFirst(posts: readonly Post[]): readonly Post[] {
  const pinRank = (post: Post) => (post.isPinned === true ? (post.pinnedAt ?? "") : null);
  return [...posts].sort((left, right) => {
    const [leftRank, rightRank] = [pinRank(left), pinRank(right)];
    if (leftRank === null || rightRank === null) return Number(rightRank !== null) - Number(leftRank !== null);
    return rightRank.localeCompare(leftRank);
  });
}

export function profileTabEmptyTitle(tab: ProfileContentTab, isSelf: boolean, displayName: string): string {
  if (tab === "clips") return isSelf ? "No clips yet" : `${displayName} hasn't posted any clips yet.`;
  if (tab === "reposts") return isSelf ? "No reposts yet" : `${displayName} hasn't reposted anything yet.`;
  if (tab === "media") return "No photos or videos yet";
  return isSelf ? "No posts yet" : `${displayName} hasn't posted yet.`;
}
