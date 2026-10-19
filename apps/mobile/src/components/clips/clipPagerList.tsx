import { useNavigation } from "@react-navigation/native";
import { FlatList, Share } from "react-native";

import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { webAppLinks } from "@/config/webAppLinks.config";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { usePostInteractions } from "@/hooks/usePostInteractions.hook";
import { clipsService } from "@/services/clips/clips.service";
import { useAuthStore } from "@/store/auth.store";
import type { Clip } from "@/types";

import { ClipPage, type ClipEngagement } from "./clipPage";
import { NUMBER_OF_UPCOMING_CLIPS_TO_PRELOAD, type ClipPagerState } from "./clipPagerState.hook";

export interface ClipPagerListProps {
  readonly pager: ClipPagerState;
  readonly clips: readonly Clip[];
  readonly listKeyPrefix: string;
  readonly onEndReached: () => void;
}

const engagementFor = (clip: Clip): ClipEngagement => ({ liked: clip.liked, likes: clip.likes, isFollowing: clip.isFollowingAuthor });

export function ClipPagerList({ pager, clips, listKeyPrefix, onEndReached }: ClipPagerListProps) {
  const navigation = useNavigation();
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
        data={clips}
        keyExtractor={(clip) => clip.id}
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
        renderItem={({ item, index }) => (
          <ClipPage
            clip={item}
            height={pageHeight}
            isActive={isPlaybackAllowed && index === activeClipIndex}
            shouldMountVideoPlayer={index >= activeClipIndex - 1 && index <= activeClipIndex + NUMBER_OF_UPCOMING_CLIPS_TO_PRELOAD}
            isMuted={isMuted}
            topInset={pager.insets.top}
            bottomInset={pager.uncoveredBottomInset}
            engagement={engagementFor(item)}
            myAvatarUrl={myAvatarUrl}
            onToggleMute={pager.toggleMute}
            onToggleLike={() => togglePostLike(item)}
            onLikeByDoubleTap={() => likeClipWithDoubleTap(item)}
            onToggleFollow={() => followClipAuthor(item)}
            onOpenComments={() => pager.setCommentsForClipId(item.id)}
            onShare={() => offerSendInChat({ kind: "clip", id: item.id }, () => shareClipLink(item))}
            onPressAuthor={() => openUserProfile(item.author.id)}
            onOpenPromotedLive={(liveSessionId) => navigation.navigate("Live", { liveId: liveSessionId })}
          />
        )}
      />
    </>
  );
}
