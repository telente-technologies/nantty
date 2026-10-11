"use client";

import { MentionText } from "@/components/mentions/mentionText";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { notificationsService } from "@/services/notifications.service";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

import styles from "./page.module.css";

function NotificationListSkeleton() {
  return (
    <ul className={styles.list} role="status" aria-label="Loading notifications">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className={styles.item} aria-hidden="true">
          <Skeleton width="50%" height={14} />
          <Skeleton width="85%" height={12} />
        </li>
      ))}
    </ul>
  );
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({ queryKey: ["shell", "notifications"], queryFn: () => notificationsService.fetchMyNotifications(), retry: false });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsService.markAllNotificationsAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shell", "notifications"] }),
  });

  const markOneAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationsService.markNotificationAsRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shell", "notifications"] }),
  });

  const notifications = notificationsQuery.data ?? [];
  const hasUnread = notifications.some((notification) => !notification.read);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Notifications</h1>
        {hasUnread ? (
          <Button size="sm" variant="secondary" busy={markAllAsReadMutation.isPending} onClick={() => markAllAsReadMutation.mutate()}>
            Mark all as read
          </Button>
        ) : null}
      </header>

      {notificationsQuery.isLoading ? (
        <NotificationListSkeleton />
      ) : notificationsQuery.isError ? (
        <ErrorState description="We couldn't load your notifications." error={notificationsQuery.error} onRetry={() => void notificationsQuery.refetch()} />
      ) : notifications.length === 0 ? (
        <EmptyState kind="notifications" title="You're all caught up" description="Order updates, replies and system messages will show up here." />
      ) : (
        <ul className={styles.list}>
          {notifications.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                className={[styles.item, notification.read ? "" : styles.itemUnread].filter(Boolean).join(" ")}
                onClick={() => (notification.read ? undefined : markOneAsReadMutation.mutate(notification.id))}
              >
                <span className={styles.itemTitle}>{notification.title}</span>
                <span className={styles.itemBody}><MentionText text={notification.body} /></span>
                <span className={styles.itemTime}>{formatTimeSincePosted(notification.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
