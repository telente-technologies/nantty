import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { postsService } from "@/services/content/posts.service";
import type { Post, TaggedUser } from "@/types";

export const taggedPeopleQueryKey = (postId: string) => ["posts", "taggedUsers", postId] as const;

export const countTaggedPeople = (post: Pick<Post, "taggedUsers" | "taggedUsersCount">) =>
  Math.max(post.taggedUsersCount ?? 0, post.taggedUsers?.length ?? 0);

export function useTaggedPeople(post: Pick<Post, "id" | "taggedUsers" | "taggedUsersCount">, enabled: boolean) {
  const inline = post.taggedUsers ?? [];
  const needsFetch = countTaggedPeople(post) > inline.length;
  const query = useInfiniteQuery({
    queryKey: taggedPeopleQueryKey(post.id),
    queryFn: ({ pageParam }) => postsService.fetchPostTaggedUsers(post.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: enabled && needsFetch,
  });
  const fetched = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);
  const people: readonly TaggedUser[] = fetched.length > 0 ? fetched : inline;
  return {
    people,
    isLoadingMore: query.isFetching,
    isError: query.isError && fetched.length === 0 && needsFetch,
    hasMore: needsFetch && (query.hasNextPage || (fetched.length === 0 && !query.isFetching)),
    loadMore: () => {
      if (query.isFetching) return;
      if (fetched.length === 0) void query.refetch();
      else if (query.hasNextPage) void query.fetchNextPage();
    },
  };
}
