import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ClipCommentsSheet } from "@/components/clips/clipCommentsSheet";
import { suggestedVideoStartQueryKey } from "@/components/home/suggestedClipsStream.hook";
import { ClipPagerList } from "@/components/clips/clipPagerList";
import { useClipPagerState } from "@/components/clips/clipPagerState.hook";
import { ArrowLeft24Icon, Flips34Icon } from "@/components/icons";
import { BrandLoader } from "@/components/ui/brandLoader";
import { EmptyState } from "@/components/ui/emptyState";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { postsService } from "@/services/content/posts.service";
import { feedsService } from "@/services/feed/feeds.service";
import { useAuthStore } from "@/store/auth.store";
import { ForcedColorSchemeScope, useTheme } from "@/theme";
import type { Clip, Post } from "@/types";
import { buildSuggestedVideoSequence } from "@/utils/suggestedVideoSequence.util";

type SuggestedVideosScreenProps = NativeStackScreenProps<MainStackParamList, "SuggestedVideos">;

const wellFormedClipIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

const isPlayableClip = (post: Post): post is Clip => post.kind === "clip" || post.media.some((media) => media.type === "video");

function SuggestedVideosMessage({ title, body, actionLabel, onAction }: { readonly title: string; readonly body: string; readonly actionLabel?: string; readonly onAction?: () => void }) {
  const { colors: themed } = useTheme();
  return (
    <View style={styles.message} pointerEvents="box-none">
      <EmptyState icon={<Flips34Icon size={28} color={themed.textMuted} />} title={title} body={body} actionLabel={actionLabel} onAction={onAction} />
    </View>
  );
}

export function SuggestedVideosScreen({ navigation, route }: SuggestedVideosScreenProps) {
  const requestedStartId = route.params?.start ?? null;
  const startIdIsWellFormed = requestedStartId !== null && wellFormedClipIdPattern.test(requestedStartId);
  const [continueWithoutStartClip, setContinueWithoutStartClip] = useState(false);
  const myAvatarUrl = useAuthStore((state) => state.user?.avatarUrl ?? null);

  const startClipQuery = useQuery({
    queryKey: suggestedVideoStartQueryKey(requestedStartId ?? ""),
    queryFn: () => postsService.fetchPostById(requestedStartId!),
    enabled: startIdIsWellFormed,
    retry: 1,
    staleTime: 60_000,
  });
  const startClip = startClipQuery.data && isPlayableClip(startClipQuery.data) ? startClipQuery.data : null;
  const startClipUnavailable = !startIdIsWellFormed || startClipQuery.isError || (startClipQuery.isSuccess && startClip === null);
  const streamEnabled = startClip !== null || continueWithoutStartClip;

  const stream = useInfiniteQuery({
    queryKey: ["suggestedVideos", "stream", requestedStartId],
    queryFn: ({ pageParam }) => feedsService.fetchSuggestedClipsPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: streamEnabled,
  });
  const clips = useMemo(() => buildSuggestedVideoSequence(startClip, (stream.data?.pages ?? []).map((page) => page.data)), [startClip, stream.data]);
  const pager = useClipPagerState(clips);

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Tabs", { screen: "Home" }));

  const renderState = () => {
    if (startClipUnavailable && !continueWithoutStartClip) {
      return <SuggestedVideosMessage title="This video isn't available" body="It may have been removed or the link is wrong." actionLabel="Watch suggested videos" onAction={() => setContinueWithoutStartClip(true)} />;
    }
    if (clips.length > 0) return null;
    if (startClipQuery.isLoading || stream.isPending) return <View style={styles.message}><BrandLoader size="lg" accessibilityLabel="Loading suggested videos" /></View>;
    if (stream.isError) return <SuggestedVideosMessage title="Couldn't load suggested videos" body="Check your connection and try again." actionLabel="Try again" onAction={() => void stream.refetch()} />;
    return <SuggestedVideosMessage title="No suggested videos right now" body="Check back soon for fresh clips." actionLabel="Back to feed" onAction={goBack} />;
  };

  return (
    <View style={styles.root} onLayout={(event) => pager.keepActiveClipWhenPageHeightChanges(event.nativeEvent.layout.height)}>
      <ClipPagerList
        pager={pager}
        clips={clips}
        listKeyPrefix="suggested-videos"
        onEndReached={() => {
          if (stream.hasNextPage && !stream.isFetchingNextPage) stream.fetchNextPage().catch(() => undefined);
        }}
      />
      <ForcedColorSchemeScope scheme="dark">{renderState()}</ForcedColorSchemeScope>
      <View style={[styles.header, { paddingTop: pager.insets.top }]} pointerEvents="box-none">
        <View style={styles.headerBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={goBack} style={styles.back}>
            <ArrowLeft24Icon color={colors.white} />
          </Pressable>
          <Text size={16} weight={700} color={colors.white} accessibilityRole="header" style={styles.title}>
            Suggested videos
          </Text>
        </View>
      </View>
      <ClipCommentsSheet
        postId={pager.commentsForClipId}
        clip={clips.find((clip) => clip.id === pager.commentsForClipId) ?? null}
        highlightCommentId={null}
        myAvatarUrl={myAvatarUrl}
        onClose={() => pager.setCommentsForClipId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  message: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, elevation: 10 },
  headerBar: { height: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});
