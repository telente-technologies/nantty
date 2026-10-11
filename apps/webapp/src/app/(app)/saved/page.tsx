"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Skeleton } from "@zudomart/web-kit";

import { SaveCollectionsBar } from "@/components/saves/saveCollectionsBar";
import { SavedItemCard } from "@/components/saves/savedItemCard";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { BookmarkIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import { UnderlineTabs } from "@/components/ui/underlineTabs";
import { useInfiniteScrollSentinel } from "@/components/ui/useInfiniteScrollSentinel.hook";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { savesService } from "@/services/saves.service";
import type { SavedItemFilter } from "@/types";

import styles from "./page.module.css";

const savedTabs: readonly { readonly value: SavedItemFilter; readonly label: string }[] = [
  { value: "all", label: "All" },
  { value: "post", label: "Posts" },
  { value: "video", label: "Videos" },
  { value: "clip", label: "Clips" },
  { value: "product", label: "Products" },
  { value: "comment", label: "Replies" },
];

const emptyCopyByFilter: Record<SavedItemFilter, { title: string; description: string; href: string; cta: string }> = {
  all: { title: "Nothing saved yet", description: "Tap the bookmark on any post, video, clip or product to keep it here.", href: "/", cta: "Browse your feed" },
  post: { title: "No saved posts", description: "Bookmark posts from your feed to read them later.", href: "/", cta: "Go to feed" },
  video: { title: "No saved videos", description: "Save long videos and come back to finish them.", href: "/explore", cta: "Find videos" },
  clip: { title: "No saved clips", description: "Save clips you want to rewatch or shop from.", href: "/clips", cta: "Watch clips" },
  product: { title: "No saved products", description: "Save products to compare prices before you buy.", href: "/mart", cta: "Open Mart" },
  comment: { title: "No saved replies", description: "Bookmark replies in a conversation to find them again.", href: "/", cta: "Go to feed" },
};

function SavedGridSkeleton() {
  return (
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className={styles.skeletonCard}>
          <Skeleton height="auto" className={styles.skeletonThumb} />
          <Skeleton height={14} width="80%" />
          <Skeleton height={12} width="50%" />
        </div>
      ))}
    </div>
  );
}

export default function SavedPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<SavedItemFilter>("all");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const collectionsQuery = useQuery({ queryKey: ["saves", "collections"], queryFn: savesService.fetchSaveCollections, retry: false });
  const savedQuery = useInfiniteQuery({
    queryKey: ["saves", "items", filter, collectionId],
    queryFn: ({ pageParam }) => savesService.fetchSavedItemsPage(filter, collectionId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const sentinelRef = useInfiniteScrollSentinel({
    hasNextPage: savedQuery.hasNextPage,
    isFetchingNextPage: savedQuery.isFetchingNextPage,
    fetchNextPage: savedQuery.fetchNextPage,
  });
  const moveMutation = useMutation({
    mutationFn: ({ saveId, targetCollectionId }: { saveId: string; targetCollectionId: string | null }) => savesService.moveSavedItemToCollection(saveId, targetCollectionId),
    onSuccess: (_item, variables) => {
      const collectionName = collectionsQuery.data?.find((collection) => collection.id === variables.targetCollectionId)?.name;
      showToast({ text: collectionName ? `Moved to ${collectionName}` : "Removed from collection" });
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["saves"] }),
  });

  const items = (savedQuery.data?.pages ?? []).flatMap((page) => page.data);
  const emptyCopy = emptyCopyByFilter[filter];
  const panelId = "saved-items-panel";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <BookmarkIcon size={22} />
        </span>
        <div>
          <h1 className={styles.title}>Saved</h1>
          <p className={styles.subtitle}>Only you can see what you've saved.</p>
        </div>
      </header>

      <UnderlineTabs options={savedTabs} value={filter} onChange={setFilter} label="Saved item types" panelId={panelId} />

      {collectionsQuery.data ? (
        <SaveCollectionsBar collections={collectionsQuery.data} activeCollectionId={collectionId} onSelectCollection={setCollectionId} />
      ) : null}

      <section id={panelId} role="tabpanel" aria-labelledby={`${panelId}-tab-${filter}`} className={styles.panel}>
        {savedQuery.isLoading ? (
          <SavedGridSkeleton />
        ) : savedQuery.isError ? (
          <ErrorState description="We couldn't load your saved items." error={savedQuery.error} onRetry={() => void savedQuery.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BookmarkIcon size={28} />}
            title={collectionId ? "This collection is empty" : emptyCopy.title}
            description={collectionId ? "Move saved items here with the collection picker on each card." : emptyCopy.description}
            action={
              <Link href={emptyCopy.href} className={styles.emptyAction}>
                {emptyCopy.cta}
              </Link>
            }
          />
        ) : (
          <div className={styles.grid}>
            {items.map((item) => (
              <SavedItemCard
                key={item.id}
                item={item}
                collections={collectionsQuery.data ?? []}
                onMoveToCollection={(targetCollectionId) => moveMutation.mutate({ saveId: item.id, targetCollectionId })}
              />
            ))}
          </div>
        )}
        <div ref={sentinelRef} />
        {savedQuery.isFetchingNextPage ? <Spinner label="Loading more saved items" /> : null}
      </section>
    </div>
  );
}
