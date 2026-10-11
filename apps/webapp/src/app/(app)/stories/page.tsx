"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { PlusIcon } from "@/components/ui/icons";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { storiesService } from "@/services/stories.service";

import styles from "../sounds/page.module.css";

export default function StoriesPage() {
  const tray = useQuery({ queryKey: ["story-tray"], queryFn: () => storiesService.fetchStoryTray() });
  if (tray.isLoading) return <ListRowsSkeleton label="Loading stories" rows={5} />;
  if (tray.isError || !tray.data) return <ErrorState description="We couldn't load stories." action={<RetryButton onRetry={() => tray.refetch()} />} />;
  if (tray.data.length === 0) return <EmptyState title="No stories yet" description="Stories from people you follow will show up here for 24 hours." action={<Link href="/create/story">Add to your story</Link>} />;
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Stories</h1>
      <div className={styles.tray}>
        <Link className={styles.trayItem} href="/create/story" aria-label="Add to your story">
          <span className={styles.avatar} aria-hidden="true"><PlusIcon size={20} /></span>
          <span className={styles.name}>Your story</span>
        </Link>
        {tray.data.map((item) => (
          <Link key={item.user.id} className={styles.trayItem} href={`/stories/${item.user.id}`}>
            {item.user.avatarUrl ? (
              <img className={[styles.avatar, item.hasUnseen ? styles.avatarUnseen : ""].filter(Boolean).join(" ")} src={item.user.avatarUrl} alt="" loading="lazy" />
            ) : (
              <span className={[styles.avatar, item.hasUnseen ? styles.avatarUnseen : ""].filter(Boolean).join(" ")} aria-hidden="true" />
            )}
            <span className={styles.name}>{item.user.username}</span>
          </Link>
        ))}
      </div>
      <p className={styles.note}>Stories disappear after 24 hours. Viewing, replies via chat and analytics for your own stories work here.</p>
    </div>
  );
}
