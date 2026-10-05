"use client";

import { useQuery } from "@tanstack/react-query";

import chipStyles from "@/components/ui/filterChips.module.css";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { usePopoverMenu } from "@/components/ui/popoverMenu.hook";
import sheetStyles from "@/components/ui/popoverMenu.module.css";
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
  const { isOpen: modeMenuIsOpen, close: modeMenuClose, containerRef: modeMenuContainerRef, triggerRef: modeMenuTriggerRef, menuRef: modeMenuMenuRef, triggerProps: modeMenuTriggerProps, menuProps: modeMenuMenuProps } = usePopoverMenu();

  if (followedQuery.isLoading) return <div className={chipStyles.chipRowLoading} />;
  const topics = followedQuery.data ?? [];
  const isModeChipActive = feedMode === "following" || activeTopicId === null;

  const chooseMode = (mode: FeedMode) => {
    modeMenuClose(true);
    onSelectMode(mode);
    if (mode === "following") onSelectTopic(null);
  };

  return (
    <div className={styles.row}>
      <div className={styles.modeWrap} ref={modeMenuContainerRef}>
        <button
          type="button"
          className={[chipStyles.chip, isModeChipActive ? chipStyles.chipActive : ""].join(" ")}
          aria-label={`Feed type: ${feedModeLabels[feedMode]}`}
          ref={modeMenuTriggerRef} {...modeMenuTriggerProps}
        >
          {feedModeLabels[feedMode]}
          <ChevronDownIcon size={14} />
        </button>
        {modeMenuIsOpen ? (
          <>
            <div className={sheetStyles.scrim} onPointerDown={() => modeMenuClose()} aria-hidden="true" />
            <div className={[styles.modeMenu, sheetStyles.sheet].join(" ")} aria-label="Feed type" ref={modeMenuMenuRef} {...modeMenuMenuProps}>
              {(Object.keys(feedModeLabels) as FeedMode[]).map((mode) => (
                <button key={mode} type="button" role="menuitemradio" aria-checked={feedMode === mode} className={styles.modeMenuItem} onClick={() => chooseMode(mode)}>
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
