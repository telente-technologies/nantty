"use client";

import { useEffect, useRef } from "react";

interface InfiniteScrollOptions {
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly fetchNextPage: () => unknown;
  readonly rootMargin?: string;
}

export function useInfiniteScrollSentinel({ hasNextPage, isFetchingNextPage, fetchNextPage, rootMargin = "600px" }: InfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fetchNextPageRef = useRef(fetchNextPage);
  fetchNextPageRef.current = fetchNextPage;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) fetchNextPageRef.current();
    }, { rootMargin });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, rootMargin]);

  return sentinelRef;
}
