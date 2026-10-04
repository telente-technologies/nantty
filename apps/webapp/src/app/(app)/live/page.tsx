"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { LiveIcon } from "@/components/ui/icons";
import { Avatar, MediaImage } from "@/components/ui/media";
import { discoveryService } from "@/services/discovery.service";
import { useSession } from "@/components/providers/sessionProvider";

import styles from "./page.module.css";

export default function LivePage() {
  const { viewer } = useSession();
  const livesQuery = useQuery({ queryKey: ["lives", "suggested"], queryFn: discoveryService.fetchSuggestedLives, retry: false, refetchInterval: 30_000 });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Live now</h1>
          <p className={styles.subtitle}>Creators and sellers streaming right now. Watch, chat and send gifts in the Zudomart app.</p>
        </div>
        {viewer?.isCreator ? (
          <span className={styles.goLiveHint}>
            <LiveIcon size={18} /> Go live from the app
          </span>
        ) : viewer ? (
          <Link href="/creator" className={styles.goLiveHint}>
            <LiveIcon size={18} /> Join the Creator Program to go live
          </Link>
        ) : null}
      </header>

      {livesQuery.isLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height="auto" className={styles.cardSkeleton} />
          ))}
        </div>
      ) : livesQuery.isError ? (
        <ErrorState description="We couldn't load live streams." action={<RetryButton onRetry={() => livesQuery.refetch()} />} />
      ) : (livesQuery.data ?? []).length === 0 ? (
        <EmptyState icon={<LiveIcon size={28} />} title="Nobody is live right now" description="Follow creators to hear when they go live." />
      ) : (
        <ul className={styles.grid}>
          {livesQuery.data?.map((live) => (
            <li key={live.id}>
              <Link href={`/live/${live.id}`} className={styles.card}>
                <span className={styles.cover}>
                  <MediaImage src={live.coverUrl} alt="" sizes="(max-width: 768px) 50vw, 300px" />
                  <span className={styles.liveBadge}>LIVE</span>
                </span>
                <span className={styles.cardBody}>
                  <Avatar name={live.host.name} src={live.host.avatarUrl} size="sm" />
                  <span className={styles.cardText}>
                    <span className={styles.cardTitle}>{live.title}</span>
                    <span className={styles.cardHost}>{live.host.name}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
