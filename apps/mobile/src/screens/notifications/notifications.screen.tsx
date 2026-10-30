import { MentionText } from "@/components/mentions/mentionText";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { Bell24Icon, BellRinging24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Header, HeaderAction } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { notificationsService } from "@/services/account/notifications.service";
import type { CategorizedNotification } from "@/types/commerce.type";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { buildInternalRoute, readInternalNotificationTargetFromUrl } from "@/components/chat/chatLinks.util";
import { inAppBrowserColorsFromTheme, openUserSuppliedWebLink } from "@/components/links/openLink.util";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

const notificationsQueryKey = ["notifications"] as const;
const NOTIFICATION_FILTERS = [{ value: "all", label: "All" }, { value: "mentions", label: "Mentions" }] as const;

export function NotificationsScreen({ navigation }: MainScreenProps<"Notifications">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof NOTIFICATION_FILTERS)[number]["value"]>("all");
  const notifications = useQuery({ queryKey: [...notificationsQueryKey, filter], queryFn: () => notificationsService.fetchMyNotifications(filter) });
  const refreshNotifications = () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
  const markAllRead = useMutation({ mutationFn: notificationsService.markAllNotificationsAsRead, onSuccess: refreshNotifications });
  const markOneRead = useMutation({ mutationFn: notificationsService.markNotificationAsRead, onSuccess: refreshNotifications });

  const openNotification = (notification: CategorizedNotification) => {
    if (!notification.read) markOneRead.mutate(notification.id);
    const url = notification.url ?? notification.data?.url;
    const target = url ? readInternalNotificationTargetFromUrl(url) : null;
    const reference = target?.reference ?? null;
    const conversationId = notification.data?.conversationId ?? target?.conversationId;
    const messageId = notification.data?.messageId ?? target?.messageId;
    const commentId = notification.data?.commentId ?? target?.commentId;
    const clipId = notification.data?.clipId ?? (reference?.kind === "clip" ? reference.id : undefined);
    const postId = notification.data?.postId ?? (reference?.kind === "post" ? reference.id : undefined);
    if (notification.kind === "followRequest") return navigation.navigate("FollowRequests");
    if (notification.kind === "followRequestAccepted" && notification.actor) {
      void queryClient.invalidateQueries({ queryKey: ["users", notification.actor.id] });
      return navigation.navigate("UserProfile", { userId: notification.actor.id });
    }
    if (conversationId) navigation.push("Chat", { conversationId, name: notification.actor?.name ?? notification.title, ...(messageId ? { messageId } : {}) });
    else if (clipId) navigation.navigate("Tabs", { screen: "Clips", params: { startId: clipId, ...(commentId ? { commentId } : {}) } });
    else if (commentId && postId) navigation.push("CommentThread", { postId, commentId });
    else if (postId) navigation.push("PostDetail", { postId, highlight: true });
    else if (notification.data?.screen === "AccountStatus") navigation.navigate("AccountStatus");
    else if (notification.data?.screen === "Verification") navigation.navigate("IdentityVerification");
    else if (notification.data?.ticketId) navigation.navigate("SupportTicketDetail", { ticketId: notification.data.ticketId });
    else if (reference) {
      const route = buildInternalRoute(reference);
      navigation.navigate(route.name, route.params as never);
    } else if (url) openUserSuppliedWebLink(url, inAppBrowserColorsFromTheme(colors));
    else if (notification.category === "orders") navigation.navigate("Orders");
    else if (notification.actor) navigation.navigate("UserProfile", { userId: notification.actor.id });
  };

  const refreshControl = usePullToRefresh(notifications.refetch);
  const hasUnread = (notifications.data ?? []).some((n) => !n.read);
  return (
    <Screen>
      <Header
        title="Notifications"
        right={
          hasUnread ? (
            <HeaderAction label="Mark all as read" onPress={() => markAllRead.mutate()}>
              <Text size={typeScale.sm} weight={500} lineHeight={16.9} color={colors.primary}>Mark all read</Text>
            </HeaderAction>
          ) : null
        }
      />
      <View style={styles.tabs} accessibilityRole="tablist">
        {NOTIFICATION_FILTERS.map((option) => (
          <Chip key={option.value} kind="filter" label={option.label} selected={filter === option.value} onPress={() => setFilter(option.value)} />
        ))}
      </View>
      <FlatList
        data={notifications.data ?? []}
        keyExtractor={(n) => n.id}
        refreshControl={refreshControl}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.title} ${item.body}${item.read ? "" : ", unread"}`}
            onPress={() => openNotification(item)}
            style={[styles.row, !item.read && styles.unreadRow]}
          >
            {item.actor ? (
              <Avatar uri={item.actor.avatarUrl} size={40} placeholderColor={colors.primaryTint} />
            ) : (
              <View style={styles.iconCircle}>
                <BellRinging24Icon size={20} color={colors.primary} />
              </View>
            )}
            <View style={styles.text}>
              <Text size={typeScale.sm} lineHeight={16.9}>
                <Text size={typeScale.sm} weight={600} lineHeight={16.9}>{item.title} </Text>
                <MentionText text={item.body} size={13} lineHeight={16.9} />
              </Text>
              <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>{formatTimeSincePosted(item.createdAt)} ago</Text>
            </View>
            {!item.read ? <View style={styles.unreadDot} /> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          notifications.isLoading ? (
            <ListSkeleton />
          ) : notifications.isError ? (
            <ErrorState error={notifications.error} compact message="Couldn't load notifications." onRetry={() => notifications.refetch()} retrying={notifications.isRefetching} />
          ) : (
            <EmptyState
              compact
              icon={<Bell24Icon color={colors.textMuted} />}
              title={filter === "mentions" ? "No mentions yet" : "You're all caught up"}
              body={filter === "mentions" ? "When someone tags you, it shows up here." : "New activity on your posts and orders will appear here."}
            />
          )
        }
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  tabs: { flexDirection: "row", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  list: { paddingVertical: spacing[2] },
  row: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], flexDirection: "row", alignItems: "center", gap: spacing[3] },
  unreadRow: { backgroundColor: colors.surface },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primarySolid },
}));
