"use client";

import { useEffect, useRef } from "react";

import { PostCard } from "@/components/feed/postCard";
import type { Post } from "@/types";
import { feedModuleRowKey } from "@/utils/feedModuleLayout.util";
import { takeRememberedFeedScrollPosition } from "@/utils/feedScrollRestoration.util";

import { FeedModuleRow } from "./feedModuleRow";
import { useFeedModules } from "./feedModules.hook";

export function FeedPostsWithModules({ posts, isForYouFeed = true }: { readonly posts: readonly Post[]; readonly isForYouFeed?: boolean }) {
  const modules = useFeedModules(posts, isForYouFeed);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || posts.length === 0) return;
    restored.current = true;
    const scrollY = takeRememberedFeedScrollPosition();
    if (scrollY !== null) requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
  }, [posts.length]);
  return (
    <>
      {modules.rows.map((row) =>
        row.type === "module" ? (
          <FeedModuleRow key={feedModuleRowKey(row.slot)} slot={row.slot} modules={modules} />
        ) : (
          <PostCard key={row.post.id} post={row.post} priority={row.postIndex < 2} surface="feed" position={row.postIndex} />
        ),
      )}
    </>
  );
}
