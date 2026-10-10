"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { soundsService } from "@/services/sounds.service";

import styles from "./page.module.css";

export default function SoundsPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const trending = useQuery({ queryKey: ["sounds", "trending"], queryFn: () => soundsService.fetchTrendingSounds() });
  const search = useQuery({ queryKey: ["sounds", "search", submittedQuery], queryFn: () => soundsService.searchSounds(submittedQuery), enabled: submittedQuery.trim().length > 0 });
  if (trending.isLoading) return <ListRowsSkeleton label="Loading sounds" rows={6} />;
  if (trending.isError || !trending.data) return <ErrorState description="We couldn't load sounds." action={<RetryButton onRetry={() => trending.refetch()} />} />;
  const results = submittedQuery.trim() ? search.data : trending.data;
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Sounds</h1>
      <form
        className={styles.form}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmittedQuery(query);
        }}
      >
        <input className={styles.input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sounds" aria-label="Search sounds" />
        <button type="submit" className={styles.primary}>Search</button>
      </form>
      <section className={styles.section} aria-label={submittedQuery.trim() ? "Search results" : "Trending sounds"}>
        <h2 className={styles.sectionTitle}>{submittedQuery.trim() ? "Results" : "Trending"}</h2>
        {search.isLoading ? (
          <ListRowsSkeleton label="Searching sounds" rows={4} />
        ) : !results || results.length === 0 ? (
          <EmptyState title="No sounds found" description="Try a different search." />
        ) : (
          <ul className={styles.list}>
            {results.map((sound) => (
              <li key={sound.id} className={styles.row}>
                <Link className={styles.rowMain} href={`/sounds/${sound.id}`}>
                  <span className={styles.rowTitle}>{sound.isOriginal ? `Original sound · @${sound.owner.username}` : `${sound.title} · @${sound.owner.username}`}</span>
                  <span className={styles.rowMeta}>{sound.usageCount.toLocaleString()} uses</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
