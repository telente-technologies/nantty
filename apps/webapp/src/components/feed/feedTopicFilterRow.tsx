"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import chipStyles from "@/components/ui/filterChips.module.css";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { feedsService } from "@/services/feeds.service";

import styles from "./feedTopicFilterRow.module.css";

export type FeedMode = "for-you" | "following";

const feedModeLabels: Record<FeedMode, string> = { "for-you": "For you", following: "Following" };

interface FeedTopicFilterRowProps {
  readonly feedMode: FeedMode;
  readonly activeTopicId: string | null;
  readonly onSelectMode: (mode: FeedMode) => void;
  readonly onSelectTopic: (topicId: string | null) => void;
}

export function FeedTopicFilterRow({ feedMode, activeTopicId, onSelectMode, onSelectTopic }: FeedTopicFilterRowProps) {
  const followedQuery = useQuery({ queryKey: ["feed", "topics"], queryFn: feedsService.fetchMyFollowedTopics, retry: false });
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);

  if (followedQuery.isLoading) return <div className={chipStyles.chipRowLoading} />;
  const topics = followedQuery.data ?? [];
  const isModeChipActive = feedMode === "following" || activeTopicId === null;

  const chooseMode = (mode: FeedMode) => {
    setIsModeMenuOpen(false);
    onSelectMode(mode);
    if (mode === "following") onSelectTopic(null);
  };

  return (
    <div className={styles.row}>
      <div className={styles.modeWrap}>
        <button
          type="button"
          className={[chipStyles.chip, isModeChipActive ? chipStyles.chipActive : ""].join(" ")}
          aria-haspopup="true"
          aria-expanded={isModeMenuOpen}
          onClick={() => setIsModeMenuOpen((open) => !open)}
        >
          {feedModeLabels[feedMode]}
          <ChevronDownIcon size={14} />
        </button>
        {isModeMenuOpen ? (
          <>
            <div className={styles.modeMenuBackdrop} onClick={() => setIsModeMenuOpen(false)} aria-hidden="true" />
            <div className={styles.modeMenu} role="group" aria-label="Feed type">
              {(Object.keys(feedModeLabels) as FeedMode[]).map((mode) => (
                <button key={mode} type="button" aria-pressed={feedMode === mode} className={styles.modeMenuItem} onClick={() => chooseMode(mode)}>
                  {feedModeLabels[mode]}
                  {feedMode === mode ? <CheckIcon size={14} /> : null}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div className={chipStyles.chipRow} role="group" aria-label="Filter your feed by topic">
        {topics.map((topic) => (
          <button
            key={topic.id}
            type="button"
            className={[chipStyles.chip, activeTopicId === topic.id ? chipStyles.chipActive : ""].join(" ")}
            aria-pressed={activeTopicId === topic.id}
            onClick={() => {
              onSelectMode("for-you");
              onSelectTopic(activeTopicId === topic.id ? null : topic.id);
            }}
          >
            {topic.name}
          </button>
        ))}
      </div>
    </div>
  );
}
