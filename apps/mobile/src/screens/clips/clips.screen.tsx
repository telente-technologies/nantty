import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ClipCommentsSheet } from "@/components/clips/clipCommentsSheet";
import { ClipPage, type ClipEngagement } from "@/components/clips/clipPage";
import { ClipsHeader } from "@/components/clips/clipsHeader";
import { GestureTipsOverlay } from "@/components/clips/gestureTipsOverlay";
import { colors } from "@/constants/colors.constant";
import type { MainStackParamList, MainTabParamList } from "@/navigation/navigation.types";
import { clipsService } from "@/services/clips.service";
import { useAuthStore } from "@/store/auth.store";
import type { Clip, ClipsFeedTab } from "@/types";

type ClipsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Clips">,
  NativeStackScreenProps<MainStackParamList>
>;

let hasShownClipGestureTips = false;

export function ClipsScreen({ navigation }: ClipsScreenProps) {
  const insets = useSafeAreaInsets();
  const myAvatarUrl = useAuthStore((s) => s.user?.avatarUrl ?? null);
  const [tab, setTab] = useState<ClipsFeedTab>("forYou");
  const [pageHeight, setPageHeight] = useState(0);
  const [engagementByClipId, setEngagementByClipId] = useState<Record<string, ClipEngagement>>({});
  const [commentsForClipId, setCommentsForClipId] = useState<string | null>(null);
  const [showGestureTips, setShowGestureTips] = useState(!hasShownClipGestureTips);
  const clips = useQuery({ queryKey: ["clips", tab], queryFn: () => clipsService.fetchClipsFeed(tab) });

  useEffect(() => {
    navigation.setOptions({ tabBarStyle: { display: "none" } });
  }, [navigation]);

  const engagementFor = (clip: Clip): ClipEngagement =>
    engagementByClipId[clip.id] ?? { liked: clip.liked, likes: clip.likes, isFollowing: clip.isFollowingAuthor };

  const updateEngagement = (clip: Clip, change: (current: ClipEngagement) => ClipEngagement) =>
    setEngagementByClipId((all) => ({ ...all, [clip.id]: change(all[clip.id] ?? engagementFor(clip)) }));

  const toggleLikeOnClip = (clip: Clip) => {
    const wasLiked = engagementFor(clip).liked;
    updateEngagement(clip, (e) => ({ ...e, liked: !wasLiked, likes: e.likes + (wasLiked ? -1 : 1) }));
    (wasLiked ? clipsService.unlikeClip(clip.id) : clipsService.likeClip(clip.id)).catch(() =>
      updateEngagement(clip, (e) => ({ ...e, liked: wasLiked, likes: e.likes + (wasLiked ? 1 : -1) })),
    );
  };

  const likeClipWithDoubleTap = (clip: Clip) => {
    if (!engagementFor(clip).liked) toggleLikeOnClip(clip);
  };

  const toggleFollowOnClipAuthor = (clip: Clip) => {
    const wasFollowing = engagementFor(clip).isFollowing;
    updateEngagement(clip, (e) => ({ ...e, isFollowing: !wasFollowing }));
    if (!wasFollowing) clipsService.followClipAuthor(clip.author.id).catch(() => updateEngagement(clip, (e) => ({ ...e, isFollowing: false })));
  };

  const shareClipLink = async (clip: Clip) => {
    await Share.share({ message: `https://zudomart.com/clips/${clip.id}` }).catch(() => undefined);
    clipsService.recordClipShare(clip.id).catch(() => undefined);
  };

  const dismissGestureTips = () => {
    hasShownClipGestureTips = true;
    setShowGestureTips(false);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ClipsHeader
        tab={tab}
        onChangeTab={setTab}
        onBack={() => navigation.navigate("Home")}
        onSearch={() => navigation.navigate("Search", { scope: "all" })}
      />
      <View style={styles.pager} onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}>
        {pageHeight > 0 ? (
          <FlatList
            data={clips.data?.data ?? []}
            keyExtractor={(c) => c.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={pageHeight}
            decelerationRate="fast"
            getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
            renderItem={({ item }) => (
              <ClipPage
                clip={item}
                height={pageHeight}
                engagement={engagementFor(item)}
                myAvatarUrl={myAvatarUrl}
                onToggleLike={() => toggleLikeOnClip(item)}
                onLikeByDoubleTap={() => likeClipWithDoubleTap(item)}
                onToggleFollow={() => toggleFollowOnClipAuthor(item)}
                onOpenComments={() => setCommentsForClipId(item.id)}
                onShare={() => shareClipLink(item)}
                onPressAuthor={() => navigation.navigate("UserProfile", { userId: item.author.id })}
              />
            )}
          />
        ) : null}
      </View>
      {showGestureTips && clips.isSuccess ? <GestureTipsOverlay onDismiss={dismissGestureTips} /> : null}
      <ClipCommentsSheet postId={commentsForClipId} myAvatarUrl={myAvatarUrl} onClose={() => setCommentsForClipId(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  pager: { flex: 1 },
});
