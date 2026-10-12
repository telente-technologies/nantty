"use client";

import { useQuery } from "@tanstack/react-query";
import { useRealtimeStatus } from "@zudomart/web-kit/src/realtime/realtimeHooks";

import { unreadNotificationsQueryKey } from "@/components/realtime/useRealtimeBridge.hook";
import { BellIcon } from "@/components/ui/icons";
import { webappLinks } from "@/config/webappLinks.config";
import { notificationsService } from "@/services/notifications.service";
import { studioRealtime } from "@/services/realtime/studioRealtime.service";

import styles from "./studioShell.module.css";

const fallbackPollMs = 60_000;

export function NotificationsLink() {
  const isRealtime = useRealtimeStatus(studioRealtime) === "live";
  const unread = useQuery({ queryKey: unreadNotificationsQueryKey, queryFn: notificationsService.fetchUnreadCount, refetchInterval: isRealtime ? false : fallbackPollMs, retry: false });
  const count = unread.data ?? 0;
  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";
  return (
    <a href={webappLinks.notifications} className={styles.navLink} target="_blank" rel="noopener noreferrer" title={label}>
      <span className={styles.navIconWithBadge}>
        <BellIcon size={20} />
        {count > 0 ? <span className={styles.navBadge} aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}
      </span>
      <span className={styles.navLabel}>Notifications</span>
      <span className="visuallyHidden">{count > 0 ? `, ${count} unread` : ""} (opens in a new tab)</span>
    </a>
  );
}
