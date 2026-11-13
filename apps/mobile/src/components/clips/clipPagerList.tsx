import { useNavigation } from "@react-navigation/native";
import { FlatList, Share, View } from "react-native";

import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { webAppLinks } from "@/config/webAppLinks.config";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { usePostInteractions } from "@/hooks/usePostInteractions.hook";
import { clipsService } from "@/services/clips/clips.service";
import { useAuthStore } from "@/store/auth.store";
import { ProductsYouMightLike, type ProductsYouMightLikeQuery } from "@/components/home/productsYouMightLike";
import { useTheme } from "@/theme";
import type { Clip } from "@/types";

import { ClipPage, type ClipEngagement } from "./clipPage";
import { NUMBER_OF_UPCOMING_CLIPS_TO_PRELOAD, type ClipPagerState } from "./clipPagerState.hook";
import type { ClipsPagerItem } from "@/screens/clips/clipsPagerItems.util";

export interface ClipPagerListProps {
  readonly pager: ClipPagerState;
  readonly items: readonly ClipsPagerItem[];
  readonly recommendations?: ProductsYouMightLikeQuery;
  readonly listKeyPrefix: string;
  readonly onEndReached: () => void;
}

const engagementFor = (clip: Clip): ClipEngagement => ({ liked: clip.liked, likes: clip.likes, isFollowing: clip.isFollowingAuthor });

export function ClipPagerList({ pager, items, recommendations, listKeyPrefix, onEndReached }: ClipPagerListProps) {
  const navigation = useNavigation();
  const { colors: themeColors } = useTheme();
  const myAvatarUrl = useAuthStore((state) => state.user?.avatarUrl ?? null);
  const openUserProfile = useOpenUserProfile();
  const { togglePostLike, followPostAuthor } = usePostInteractions();
  const { offerSendInChat, sendInChatElement } = useShareToChat();
  const { pageHeight, activeClipIndex, isMuted, isPlaybackAllowed } = pager;

  const likeClipWithDoubleTap = (clip: Clip) => {
    if (clip.sponsored) return;
    if (!clip.liked) togglePostLike(clip);
  };
  const followClipAuthor = (clip: Clip) => {
    if (!clip.isFollowingAuthor) followPostAuthor(clip);
  };
  const shareClipLink = async (clip: Clip) => {
    await Share.share({ message: webAppLinks.clip(clip.id) }).catch(() => undefined);
    clipsService.recordClipShare(clip.id).catch(() => undefined);
  };

  if (pageHeight <= 0) return <>{sendInChatElement}</>;
  return (
    <>
      {sendInChatElement}
      <FlatList
        key={`${listKeyPrefix}-opened-at-${pager.clipIndexToOpenListAt}`}
        ref={pager.clipsListRef}
        initialScrollIndex={pager.clipIndexToOpenListAt}
        data={items}
        keyExtractor={(item) => item.key}
        pagingEnabled
        snapToInterval={pageHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
        viewabilityConfigCallbackPairs={pager.viewabilityConfigCallbackPairs}
        onEndReachedThreshold={2}
        onEndReached={onEndReached}
        extraData={{ activeClipIndex, isMuted, isPlaybackAllowed }}
        renderItem={({ item, index }) => item.kind === "productRecommendations" ? recommendations ? (
          <View style={{ height: pageHeight, paddingTop: pager.insets.top + 72, paddingBottom: pager.uncoveredBottomInset + 24, paddingHorizontal: 16, backgroundColor: themeColors.background }}>
            <ProductsYouMightLike recommendations={recommendations} interactionSurface="clips_recommendations" presentation="clips" />
          </View>
        ) : null : (
          <ClipPage
            clip={item.clip}
            height={pageHeight}
            isActive={isPlaybackAllowed && index === activeClipIndex}
            shouldMountVideoPlayer={index >= activeClipIndex - 1 && index <= activeClipIndex + NUMBER_OF_UPCOMING_CLIPS_TO_PRELOAD}
            isMuted={isMuted}
            topInset={pager.insets.top}
            bottomInset={pager.uncoveredBottomInset}
            engagement={engagementFor(item.clip)}
            myAvatarUrl={myAvatarUrl}
            onToggleMute={pager.toggleMute}
            onToggleLike={() => togglePostLike(item.clip)}
            onLikeByDoubleTap={() => likeClipWithDoubleTap(item.clip)}
            onToggleFollow={() => followClipAuthor(item.clip)}
            onOpenComments={() => pager.setCommentsForClipId(item.clip.id)}
            onShare={() => offerSendInChat({ kind: "clip", id: item.clip.id }, () => shareClipLink(item.clip))}
            onPressAuthor={() => openUserProfile(item.clip.author.id)}
            onOpenPromotedLive={(liveSessionId) => navigation.navigate("Live", { liveId: liveSessionId })}
          />
        )}
      />
    </>
  );
}
