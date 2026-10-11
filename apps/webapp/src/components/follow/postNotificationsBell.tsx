"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { CheckIcon, PostBellIcon, PostBellRingingIcon, PostBellSlashIcon } from "@/components/ui/icons";
import { usePopoverMenu } from "@/components/ui/popoverMenu.hook";
import sheetStyles from "@/components/ui/popoverMenu.module.css";
import { showToast } from "@/components/ui/toast";
import { createIdempotencyKey } from "@/services/clientApi.service";
import { followsService } from "@/services/posts.service";
import type { PostNotificationLevel } from "@/types";
import { postNotificationBellLabel, postNotificationOptions, setPostNotificationLevelEverywhere } from "@/utils/followToggle.util";

import styles from "./postNotificationsBell.module.css";

function LevelIcon({ level, size }: { readonly level: PostNotificationLevel; readonly size: number }) {
  if (level === "off") return <PostBellSlashIcon size={size} />;
  return level === "posts_and_lives" ? <PostBellRingingIcon size={size} /> : <PostBellIcon size={size} weight="fill" />;
}

interface PostNotificationsBellProps {
  readonly userId: string;
  readonly username: string;
  readonly initialLevel: PostNotificationLevel;
  readonly onLevelChange?: (level: PostNotificationLevel) => void;
}

export function PostNotificationsBell({ userId, username, initialLevel, onLevelChange }: PostNotificationsBellProps) {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState(initialLevel);
  const confirmed = useRef(initialLevel);
  const pending = useRef(false);
  const { isOpen, close, containerRef, triggerRef, menuRef, triggerProps, menuProps } = usePopoverMenu();

  useEffect(() => {
    confirmed.current = initialLevel;
    setLevel(initialLevel);
  }, [initialLevel]);

  const apply = (next: PostNotificationLevel) => {
    setLevel(next);
    setPostNotificationLevelEverywhere(queryClient, userId, next);
    onLevelChange?.(next);
  };

  const choose = async (next: PostNotificationLevel) => {
    close(true);
    if (pending.current || next === confirmed.current) return;
    pending.current = true;
    const previous = confirmed.current;
    apply(next);
    try {
      const result = await followsService.setPostNotifications(userId, next, createIdempotencyKey("post-notifications"));
      confirmed.current = result?.level ?? next;
      if (confirmed.current !== next) apply(confirmed.current);
    } catch {
      apply(previous);
      showToast({ text: "Couldn't update notifications. Try again.", tone: "error" });
    } finally {
      pending.current = false;
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button type="button" className={[styles.trigger, level === "off" ? "" : styles.triggerActive].join(" ")} aria-label={postNotificationBellLabel(level, username)} ref={triggerRef} {...triggerProps}>
        <LevelIcon level={level} size={18} />
      </button>
      {isOpen ? <div className={sheetStyles.scrim} aria-hidden="true" onPointerDown={() => close()} /> : null}
      {isOpen ? (
        <div className={[styles.menu, sheetStyles.sheet].join(" ")} aria-label={`Get notified when @${username} posts`} ref={menuRef} {...menuProps}>
          <p className={styles.heading}>Get notified when @{username} posts</p>
          {postNotificationOptions.map((option) => (
            <button key={option.level} type="button" role="menuitemradio" aria-checked={option.level === level} className={styles.item} onClick={() => void choose(option.level)}>
              <LevelIcon level={option.level} size={20} />
              <span className={styles.itemText}>
                <span>{option.label}</span>
                <span className={styles.detail}>{option.detail}</span>
              </span>
              {option.level === level ? <CheckIcon size={16} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
