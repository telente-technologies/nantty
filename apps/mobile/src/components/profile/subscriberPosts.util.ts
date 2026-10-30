import type { Post } from "@/types";

export function hasSubscriberOnlyPosts(posts: readonly Pick<Post, "subscriberOnly">[] | undefined): boolean {
  return posts?.some((post) => post.subscriberOnly === true) ?? false;
}

export function subscriberPostsRequireAccessGate(posts: readonly Pick<Post, "subscriberOnly" | "viewerHasAccess">[]): boolean {
  return posts.some((post) => post.subscriberOnly === true && post.viewerHasAccess !== true);
}
