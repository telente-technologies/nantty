"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/media";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { rankingsService, type RankingBoard, type RankingScope } from "@/services/rankings.service";

import styles from "../sounds/page.module.css";

const BOARDS: readonly { readonly key: RankingBoard; readonly label: string }[] = [
  { key: "supporter", label: "Supporters" },
  { key: "streamer", label: "Streamers" },
  { key: "creator", label: "Creators" },
];

const SCOPES: readonly { readonly key: RankingScope; readonly label: string }[] = [
  { key: "global", label: "Global" },
  { key: "country", label: "Country" },
  { key: "category", label: "Category" },
];

export default function RankingsPage() {
  const [board, setBoard] = useState<RankingBoard>("supporter");
  const [scope, setScope] = useState<RankingScope>("global");
  const rankings = useQuery({
    queryKey: ["rankings", board, scope],
    queryFn: () => rankingsService.fetchRankings({ board, scope, period: "week", ...(scope === "country" ? { countryCode: "NG" } : {}), ...(scope === "category" ? { categoryId: "gaming" } : {}) }),
  });
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Rankings</h1>
      <div className={styles.chips} role="group" aria-label="Ranking board">
        {BOARDS.map((option) => (
          <button key={option.key} type="button" className={[styles.chip, board === option.key ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={board === option.key} onClick={() => setBoard(option.key)}>{option.label}</button>
        ))}
      </div>
      <div className={styles.chips} role="group" aria-label="Ranking scope">
        {SCOPES.map((option) => (
          <button key={option.key} type="button" className={[styles.chip, scope === option.key ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={scope === option.key} onClick={() => setScope(option.key)}>{option.label}</button>
        ))}
      </div>
      {rankings.isLoading ? <ListRowsSkeleton label="Loading rankings" rows={8} /> : null}
      {rankings.isError ? <ErrorState description="We couldn't load rankings." action={<RetryButton onRetry={() => rankings.refetch()} />} /> : null}
      {rankings.data && rankings.data.data.length === 0 ? <EmptyState title="No rankings yet" description="Rankings update weekly." /> : null}
      {rankings.data && rankings.data.data.length > 0 ? (
        <ul className={styles.list}>
          {rankings.data.data.map((entry) => (
            <li key={`${entry.rank}-${entry.user.id}`} className={styles.row}>
              <span className={styles.rowMeta}>#{entry.rank}</span>
              <Avatar name={entry.user.name} src={entry.user.avatarUrl} size="md" />
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{entry.user.name}</span>
                <span className={styles.rowMeta}>@{entry.user.username}</span>
              </span>
              <span className={styles.rowMeta}>{entry.points.toLocaleString()} pts</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
