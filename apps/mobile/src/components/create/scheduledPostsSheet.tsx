import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { EmptyState } from "@/components/ui/emptyState";
import { Text } from "@/components/ui/text";
import { SchedulePostSheet } from "@/components/create/schedulePostSheet";
import { scheduledPostsService } from "@/services/content/scheduledPosts.service";
import type { ID, ScheduledPostSummary } from "@/types";
import { makeThemedStyles, useTheme } from "@/theme";
import { useToastStore } from "@/store/toast.store";

function scheduledTime(value: string | null): string {
  if (value === null) return "Time unavailable";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function failureMessage(reason: ScheduledPostSummary["failureReason"]): string {
  if (reason === "media_failed") return "Media processing failed. Cancel this schedule and create a new post with working media.";
  if (reason === "media_processing_timeout") return "Media is still processing. Reschedule after it is ready.";
  if (reason === "author_unavailable") return "This account cannot publish right now. Resolve account access before rescheduling.";
  if (reason === "profile_unavailable") return "The selected posting profile is unavailable. Create a new post using an active profile.";
  return "This post could not be published. Cancel it and create a new post.";
}

export function ScheduledPostsButton() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Manage scheduled posts" hitSlop={8} onPress={() => setVisible(true)}>
        <Text size={14} weight={600} lineHeight={16.8} color={colors.primary}>Scheduled</Text>
      </Pressable>
      <ScheduledPostsSheet visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

export function ScheduledPostsSheet({ visible, onClose }: { readonly visible: boolean; readonly onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [rescheduleId, setRescheduleId] = useState<ID | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["scheduled-posts"],
    queryFn: ({ pageParam }) => scheduledPostsService.list(pageParam),
    initialPageParam: undefined as ID | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: visible,
  });
  const posts = query.data?.pages.flatMap((page) => page.data) ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
  const publishNow = useMutation({
    mutationFn: (postId: ID) => scheduledPostsService.publishNow(postId),
    onSuccess: () => { void refresh(); showToast("Publishing now"); },
  });
  const cancel = useMutation({
    mutationFn: (postId: ID) => scheduledPostsService.cancel(postId),
    onSuccess: () => { void refresh(); showToast("Schedule cancelled"); },
  });
  const reschedule = useMutation({
    mutationFn: ({ postId, scheduledAt }: { readonly postId: ID; readonly scheduledAt: string }) => scheduledPostsService.reschedule(postId, scheduledAt),
    onSuccess: () => { setRescheduleId(null); void refresh(); showToast("Schedule updated"); },
  });
  const confirmCancel = (post: ScheduledPostSummary) => Alert.alert("Cancel scheduled post?", "This keeps the post private and removes it from your scheduled list.", [
    { text: "Keep scheduled", style: "cancel" },
    { text: "Cancel schedule", style: "destructive", onPress: () => cancel.mutate(post.id) },
  ]);

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose} title="Scheduled posts" subtitle="Only you can see these posts until they publish." scrollable>
        {query.isLoading ? <Text size={14} lineHeight={19} color={colors.textMuted}>Loading scheduled posts…</Text> : null}
        {query.isError ? (
          <View style={styles.error}>
            <Text size={14} lineHeight={19} color={colors.error}>We couldn&apos;t load scheduled posts.</Text>
            <Button title="Try again" variant="subtle" onPress={() => void query.refetch()} />
          </View>
        ) : null}
        {query.isSuccess && posts.length === 0 ? <EmptyState compact title="Nothing scheduled" body="Posts you schedule will appear here. You can change the time, publish now, or cancel them." /> : null}
        <View style={styles.list}>
          {posts.map((post) => (
            <View key={post.id} style={styles.card}>
              <View style={styles.row}>
                <Text size={13} weight={600} lineHeight={17} color={post.status === "failed" ? colors.error : colors.primary}>
                  {post.status === "failed" ? "Needs attention" : scheduledTime(post.scheduledAt)}
                </Text>
                {post.status === "failed" ? <Text size={12} lineHeight={16} color={colors.textMuted}>{failureMessage(post.failureReason)}</Text> : null}
                <Text size={14} lineHeight={19} numberOfLines={3}>{post.text || `${post.media.length} attachment${post.media.length === 1 ? "" : "s"}`}</Text>
                <Text size={12} lineHeight={16} color={colors.textMuted}>{post.media.length} media item{post.media.length === 1 ? "" : "s"}</Text>
              </View>
              <View style={styles.actions}>
                <Button title="Publish now" variant="outline" disabled={post.status === "failed" || publishNow.isPending || cancel.isPending} onPress={() => publishNow.mutate(post.id)} style={styles.action} />
                <Button title="Reschedule" variant="subtle" disabled={(post.status === "failed" && post.failureReason !== "media_processing_timeout" && post.failureReason !== "author_unavailable") || reschedule.isPending || cancel.isPending} onPress={() => { setRescheduleId(post.id); onClose(); }} style={styles.action} />
                <Button title="Cancel" variant="danger" disabled={cancel.isPending || publishNow.isPending} onPress={() => confirmCancel(post)} style={styles.action} />
              </View>
            </View>
          ))}
        </View>
        {query.hasNextPage ? <Button title={query.isFetchingNextPage ? "Loading…" : "Load more"} variant="subtle" disabled={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} /> : null}
      </BottomSheet>
      <SchedulePostSheet
        visible={rescheduleId !== null}
        submitting={reschedule.isPending}
        errorMessage={reschedule.error instanceof Error ? reschedule.error.message : null}
        onClose={() => { setRescheduleId(null); onClose(); }}
        onSchedule={(scheduledAt) => { if (rescheduleId !== null) reschedule.mutate({ postId: rescheduleId, scheduledAt }); }}
      />
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { gap: 12, paddingBottom: 16 },
  card: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, gap: 12 },
  row: { gap: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { flexGrow: 1, flexBasis: "30%" },
  error: { gap: 10, paddingVertical: 12 },
}));
