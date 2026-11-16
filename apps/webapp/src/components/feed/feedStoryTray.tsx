"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { AppIcon } from "@/components/ui/appIcon";
import { Avatar } from "@/components/ui/media";
import { storiesService } from "@/services/stories.service";
import { buildInboxStoryItems } from "@/components/messages/inboxStoryTray.util";

import styles from "./feedStoryTray.module.css";

export function FeedStoryTray() {
  const storyTray = useQuery({
    queryKey: ["story-tray"],
    queryFn: storiesService.fetchStoryTray,
    retry: false,
  });

  if (!storyTray.data) return null;

  return (
    <nav className={styles.tray} aria-label="Stories">
      {buildInboxStoryItems(storyTray.data).map((item) => (
        <Link key={item.key} className={styles.item} href={item.href} aria-label={item.accessibleLabel}>
          <span className={[styles.avatar, item.hasUnseen ? styles.unseen : ""].filter(Boolean).join(" ")}>
            {item.isOwnStory ? <AppIcon name="plus24" size={20} /> : <Avatar name={item.name} src={item.avatarUrl} size="sm" />}
          </span>
          <span className={styles.name}>{item.name}</span>
        </Link>
      ))}
    </nav>
  );
}
