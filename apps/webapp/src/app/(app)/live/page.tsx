"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { InlineLink } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { LiveIcon } from "@/components/ui/icons";
import { Avatar, MediaImage } from "@/components/ui/media";
import { discoveryService } from "@/services/discovery.service";
import { useSession } from "@/components/providers/sessionProvider";

import styles from "./page.module.css";

export default function LivePage() {
  const { viewer } = useSession();
  const livesQuery = useQuery({ queryKey: ["lives", "suggested"], queryFn: discoveryService.fetchSuggestedLives, retry: false, refetchInterval: 30_000, enabled: viewer !== null });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Live now</h1>
          <p className={styles.subtitle}>Creators and sellers streaming right now. Watch, chat and send gifts.</p>
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

      {viewer === null ? (
        <SignInRequiredState title="Sign in to watch live" description="Sign in or create a free account to see who is live and join the chat." />
      ) : livesQuery.isLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height="auto" className={styles.cardSkeleton} />
          ))}
        </div>
      ) : livesQuery.isError ? (
        <ErrorState error={livesQuery.error} description="We couldn't load live streams." onRetry={() => void livesQuery.refetch()} />
      ) : (livesQuery.data ?? []).length === 0 ? (
        <EmptyState kind="lives" title="Nobody is live right now" description="Follow creators to hear when they go live." action={<InlineLink href="/clips">Watch clips instead</InlineLink>} />
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
