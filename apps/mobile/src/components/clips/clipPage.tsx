import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { Bell24Icon, BellSlash24Icon, BoxArrowDown24Icon, Play24Icon, Trash24Icon } from "@/components/icons";
import { useDeleteOwnPost } from "@/components/feed/useDeleteOwnPost.hook";
import { postNotificationMuteLabel, usePostNotificationMute } from "@/components/feed/postNotificationMute.hook";
import { canOfferPostNotificationMute } from "@/utils/postNotificationMute.util";
import { ClipLookOverlay, isClipLookId } from "@/components/create/clip/clipLook.constant";
import { Text } from "@/components/ui/text";
import { ClipVideoPlayer, VideoPosterOnly, type VideoPlaybackProgress } from "@/components/media/clipVideoPlayer";
import { LandscapeVideoFullScreenModal } from "@/components/media/landscapeVideoFullScreenModal";
import { isLandscapeMedia } from "@/components/media/videoOrientation.util";
import { ViewFullScreenButton } from "@/components/media/viewFullScreenButton";
import { VideoSeekBar } from "@/components/media/videoSeekBar";
import { isScrubbableDuration } from "@/utils/videoSeek.util";
import { isContentLockedForViewer, SubscriberOnlyLock } from "@/components/coins/subscriberOnlyLock";
import { TipSheet } from "@/components/coins/tipSheet";
import { ContentOptionsSheet } from "@/components/moderation/contentOptionsSheet";
import { canOfferDownloadForPost, findFirstDownloadableMedia } from "@/components/downloads/downloadablePostMedia.util";
import { useScreenshotSharePrompt } from "@/hooks/useScreenshotSharePrompt.hook";
import { useMediaDownloadStore } from "@/store/mediaDownload.store";
import { requireAuthThen } from "@/utils/requireAuth.util";
import { colors } from "@/constants/colors.constant";
import { useTheme } from "@/theme";
import { useAuthStore } from "@/store/auth.store";
import type { Clip } from "@/types";

import { ClipActionRail } from "./clipActionRail";
import { ClipDetails } from "./clipDetails";
import { CLIP_PLAYBACK_CONTROLS_HEIGHT, ClipPlaybackControls } from "./clipPlaybackControls";
import { clipCaptionMaxHeight, clipOverlayBottomOffset } from "./clipPageLayout.util";
import { ClipReadabilityScrim } from "./clipReadabilityScrim";
import { LikeBurst } from "./likeBurst";
import { SeekRipple } from "./seekRipple";
import { useClipSeekGestures } from "./clipSeekGestures.hook";
import { CommentStickerOverlay } from "./videoReply/commentStickerOverlay";
import { PromotedLiveOverlay } from "./promotedLiveOverlay";
import { webAppLinks } from "@/config/webAppLinks.config";
import { TaggedPeopleSheet } from "@/components/taggedPeople/taggedPeopleSheet";
import { ViewsExplainerSheet } from "@/components/feed/viewsExplainerSheet";
import { useIsOwnPost } from "@/hooks/useIsOwnPost.hook";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { feedInteractionsService, interactionTargetOf } from "@/services/feed/feedInteractions.service";

import { useClipWatchTracking } from "./useClipWatchTracking.hook";

export interface ClipEngagement {
  readonly liked: boolean;
  readonly likes: number;
  readonly isFollowing: boolean;
}

export interface ClipPageProps {
  readonly clip: Clip;
  readonly height: number;
  readonly isActive: boolean;
  readonly shouldMountVideoPlayer: boolean;
  readonly isMuted: boolean;
  readonly topInset: number;
  readonly bottomInset: number;
  readonly engagement: ClipEngagement;
  readonly myAvatarUrl: string | null;
  readonly onToggleMute: () => void;
  readonly onToggleLike: () => void;
  readonly onLikeByDoubleTap: () => void;
  readonly onToggleFollow: () => void;
  readonly onOpenComments: () => void;
  readonly onShare: () => void;
  readonly onPressAuthor: () => void;
  readonly onOpenPromotedLive?: (liveSessionId: string) => void;
}

const PLAYBACK_SPEED_STEPS = [1, 1.5, 2, 0.5] as const;
const FOREGROUND_ON_VIDEO = colors.white;

function ClipPageComponent(props: ClipPageProps) {
  const { colors: themeColors } = useTheme();
  const { clip, engagement, isActive } = props;
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState<VideoPlaybackProgress>({ currentSeconds: 0, durationSeconds: clip.durationSeconds });
  const [playbackSpeedStepIndex, setPlaybackSpeedStepIndex] = useState(0);
  const [isHeldForFastForward, setIsHeldForFastForward] = useState(false);
  const [isOptionsSheetOpen, setIsOptionsSheetOpen] = useState(false);
  const [hasOpenedOptionsSheet, setHasOpenedOptionsSheet] = useState(false);
  const openClipOptions = () => {
    setHasOpenedOptionsSheet(true);
    setIsOptionsSheetOpen(true);
  };
  const startBrandedDownload = useMediaDownloadStore((state) => state.startBrandedDownload);
  const downloadableVideo = canOfferDownloadForPost(clip) ? findFirstDownloadableMedia(clip) : undefined;
  useScreenshotSharePrompt(clip, isActive);
  const video = clip.media.find((item) => item.type === "video") ?? clip.media[0];
  const isLandscapeVideo = isLandscapeMedia(video);
  const { width: windowWidth } = useWindowDimensions();
  const letterboxedVideoHeight = video?.width && video.height ? (windowWidth * video.height) / video.width : (windowWidth * 9) / 16;
  const [isFullScreenPlayerOpen, setIsFullScreenPlayerOpen] = useState(false);
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const { togglePostNotifications } = usePostNotificationMute();
  const [isTipSheetOpen, setIsTipSheetOpen] = useState(false);
  const [isTaggedSheetOpen, setIsTaggedSheetOpen] = useState(false);
  const canTipAuthor = clip.author.isCreator === true && clip.author.id !== signedInUserId;
  const isClipLockedForViewer = isContentLockedForViewer(clip);
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const isOwnClip = useIsOwnPost(clip);
  const { confirmAndDelete } = useDeleteOwnPost();
  const [isViewsSheetOpen, setIsViewsSheetOpen] = useState(false);
  const interactionTarget = useMemo(() => interactionTargetOf(clip), [clip]);
  const durationSeconds = playbackProgress.durationSeconds || clip.durationSeconds;
  const markWatchSeek = useClipWatchTracking(interactionTarget, isActive && !isClipLockedForViewer, playbackProgress.currentSeconds, durationSeconds);
  const isSeekAllowed = !!video && !isClipLockedForViewer && !clip.sponsored && !clip.promotedLive;
  const showSeekBar = !!video && !isClipLockedForViewer && !clip.promotedLive && props.shouldMountVideoPlayer;
  const seekGestures = useClipSeekGestures({
    isActive,
    canSeek: isSeekAllowed && isScrubbableDuration(durationSeconds),
    pageWidth: windowWidth,
    onSingleTap: () => {
      if (clip.promotedLive && props.onOpenPromotedLive) props.onOpenPromotedLive(clip.promotedLive.liveSessionId);
      else setIsPausedByUser((paused) => !paused);
    },
    onDoubleTapLike: () => {
      setBurstKey((k) => k + 1);
      props.onLikeByDoubleTap();
    },
    onSeeked: markWatchSeek,
  });
  const openViews = () => (isOwnClip ? navigation.navigate("PostAnalytics", { postId: clip.id }) : setIsViewsSheetOpen(true));
  const openAuthorProfile = () => {
    feedInteractionsService.recordProfileClick(interactionTarget, "clips");
    props.onPressAuthor();
  };
  const toggleFollowAuthor = () => {
    if (!engagement.isFollowing) feedInteractionsService.recordFollow(interactionTarget, "clips");
    props.onToggleFollow();
  };

  const showPlaybackControls = isActive && isPausedByUser;
  const overlayBottomOffset = clipOverlayBottomOffset(props.bottomInset, showSeekBar);
  const tapHint = isSeekAllowed ? "double tap the middle to like, double tap the left or right side to skip 10 seconds" : "double tap to like";

  return (
    <View style={[styles.page, { height: props.height }]}>
      <Pressable
        accessibilityLabel={isPausedByUser ? `Clip paused. Tap to play, ${tapHint}, hold to play at 2x` : `Clip. Tap to pause, ${tapHint}, hold to play at 2x`}
        onPress={(event) => seekGestures.handleTap(event.nativeEvent.pageX)}
        onLongPress={() => setIsHeldForFastForward(true)}
        onPressOut={() => setIsHeldForFastForward(false)}
        delayLongPress={300}
        style={StyleSheet.absoluteFill}
      >
        {isClipLockedForViewer ? (
          <SubscriberOnlyLock creatorId={clip.author.id} creatorName={clip.author.name} blurredPreviewUrl={video?.posterUrl ?? null} />
        ) : video && props.shouldMountVideoPlayer ? (
          <ClipVideoPlayer
            media={video}
            isActive={isActive && !isFullScreenPlayerOpen}
            contentFit={isLandscapeVideo ? "contain" : "cover"}
            isMuted={props.isMuted || clip.sound?.status === "under_copyright_review"}
            isPausedByUser={isPausedByUser || isTaggedSheetOpen || seekGestures.isScrubbing}
            playbackRate={isHeldForFastForward ? 2 : PLAYBACK_SPEED_STEPS[playbackSpeedStepIndex]}
            onPlaybackProgress={isActive ? setPlaybackProgress : undefined}
            controllerRef={seekGestures.controllerRef}
            style={StyleSheet.absoluteFill}
          />
        ) : video ? (
          <VideoPosterOnly media={video} contentFit={isLandscapeVideo ? "contain" : "cover"} style={StyleSheet.absoluteFill} />
        ) : null}
        {clip.replyToComment ? <CommentStickerOverlay clip={clip} /> : null}
        <ClipReadabilityScrim edge="top" height={props.topInset + 96} />
        <ClipReadabilityScrim edge="bottom" height={overlayBottomOffset + 260} />
        {showPlaybackControls ? (
          <View pointerEvents="none" style={styles.centerPlayIcon}>
            <Play24Icon size={48} color={FOREGROUND_ON_VIDEO} />
          </View>
        ) : null}
        {isHeldForFastForward ? (
          <View pointerEvents="none" style={[styles.fastForwardBadge, { top: props.topInset + 64 }]}>
            <Text size={13} weight={600} lineHeight={16.9} color={FOREGROUND_ON_VIDEO}>
              2×
            </Text>
          </View>
        ) : null}
        <LikeBurst burstKey={burstKey} />
        <SeekRipple ripple={seekGestures.seekRipple} />
        <ClipLookOverlay look={isClipLookId(clip.look) ? clip.look : "none"} />
      </Pressable>
      {clip.promotedLive ? (
        <PromotedLiveOverlay
          topInset={props.topInset}
          viewers={clip.promotedLive.viewers}
          onWatchLive={() => props.onOpenPromotedLive?.(clip.promotedLive!.liveSessionId)}
        />
      ) : null}
      {isLandscapeVideo && video ? (
        <View style={[styles.fullScreenButtonRow, { top: props.height / 2 + letterboxedVideoHeight / 2 + 12 }]} pointerEvents="box-none">
          <ViewFullScreenButton onPress={() => setIsFullScreenPlayerOpen(true)} />
        </View>
      ) : null}
      <View style={[styles.overlay, { bottom: overlayBottomOffset }, seekGestures.isScrubbing ? styles.hiddenWhileScrubbing : null]} pointerEvents="box-none">
        <ClipDetails
          isActive={isActive}
          clip={clip}
          isFollowing={engagement.isFollowing}
          onToggleFollow={toggleFollowAuthor}
          onPressAuthor={openAuthorProfile}
          foregroundColor={FOREGROUND_ON_VIDEO}
          onOpenTaggedPeople={() => setIsTaggedSheetOpen(true)}
          captionMaxHeight={clipCaptionMaxHeight(props.height, props.topInset, overlayBottomOffset)}
        />
        <ClipActionRail
          liked={engagement.liked}
          likes={engagement.likes}
          comments={clip.comments}
          shares={clip.shares}
          views={clip.views}
          onToggleLike={props.onToggleLike}
          onOpenComments={props.onOpenComments}
          onShare={props.onShare}
          onMore={openClipOptions}
          onPressViews={openViews}
          isOwnClip={isOwnClip}
          onTip={canTipAuthor ? () => setIsTipSheetOpen(true) : undefined}
          saveTarget={{ type: "clip", targetId: clip.id }}
          savedAccordingToServer={clip.bookmarked}
          saveCount={clip.saveCount ?? 0}
          foregroundColor={FOREGROUND_ON_VIDEO}
          minimal={!!clip.sponsored}
        />
      </View>
      {showSeekBar ? (
        <VideoSeekBar
          currentSeconds={playbackProgress.currentSeconds}
          durationSeconds={durationSeconds}
          bufferedSeconds={playbackProgress.bufferedSeconds}
          canSeek={isSeekAllowed && isActive}
          onScrubStart={seekGestures.scrubHandlers.onScrubStart}
          onScrubEnd={seekGestures.scrubHandlers.onScrubEnd}
          onSeekBy={seekGestures.seekBy}
          style={[styles.seekBar, { bottom: showPlaybackControls ? CLIP_PLAYBACK_CONTROLS_HEIGHT + props.bottomInset : props.bottomInset }]}
        />
      ) : null}
      {showPlaybackControls ? (
        <View style={[styles.bottomChrome, { paddingBottom: props.bottomInset, backgroundColor: themeColors.surface }]}>
          <ClipPlaybackControls
            remainingSeconds={Math.max(durationSeconds - playbackProgress.currentSeconds, 0)}
            isMuted={props.isMuted}
            playbackSpeed={PLAYBACK_SPEED_STEPS[playbackSpeedStepIndex]}
            onPressPlay={() => setIsPausedByUser(false)}
            onPressSpeed={() => setPlaybackSpeedStepIndex((index) => (index + 1) % PLAYBACK_SPEED_STEPS.length)}
            onPressVolume={props.onToggleMute}
            onPressFullscreen={() => (isLandscapeVideo ? setIsFullScreenPlayerOpen(true) : setIsPausedByUser(false))}
          />
        </View>
      ) : null}
      {hasOpenedOptionsSheet ? (
        <ContentOptionsSheet
          target={
            isOptionsSheetOpen
              ? { targetType: "clip", targetId: clip.id, authorId: clip.author.id, shareUrl: webAppLinks.clip(clip.id) }
              : null
          }
          onClose={() => setIsOptionsSheetOpen(false)}
          additionalActions={[
            ...(downloadableVideo ? [{ label: "Download", icon: <BoxArrowDown24Icon size={20} />, onPress: () => requireAuthThen(() => startBrandedDownload(clip.id, downloadableVideo), null, "download") }] : []),
            ...(canOfferPostNotificationMute(isSignedIn, clip)
              ? [{ label: postNotificationMuteLabel(clip.viewerNotificationsMuted === true), icon: clip.viewerNotificationsMuted === true ? <Bell24Icon size={20} /> : <BellSlash24Icon size={20} />, onPress: () => togglePostNotifications(clip) }]
              : []),
            ...(isOwnClip ? [{ label: "Delete", icon: <Trash24Icon size={20} />, destructive: true, onPress: () => confirmAndDelete({ id: clip.id, kind: "clip" }) }] : []),
          ]}
        />
      ) : null}
      <LandscapeVideoFullScreenModal
        media={isFullScreenPlayerOpen && video ? video : null}
        saveTarget={{ type: "clip", targetId: clip.id }}
        savedAccordingToServer={clip.bookmarked}
        isMuted={props.isMuted}
        onToggleMute={props.onToggleMute}
        canSeek={isSeekAllowed}
        startAtSeconds={playbackProgress.currentSeconds}
        onClose={(positionSeconds) => {
          setIsFullScreenPlayerOpen(false);
          if (positionSeconds !== undefined && isSeekAllowed) seekGestures.seekTo(positionSeconds);
        }}
        look={clip.look}
      />
      {isViewsSheetOpen ? <ViewsExplainerSheet visible onClose={() => setIsViewsSheetOpen(false)} /> : null}
      {isTaggedSheetOpen ? <TaggedPeopleSheet post={clip} visible onClose={() => setIsTaggedSheetOpen(false)} /> : null}
      {isTipSheetOpen ? (
        <TipSheet target={{ targetType: "clip", targetId: clip.id, creatorName: clip.author.name }} onClose={() => setIsTipSheetOpen(false)} />
      ) : null}
    </View>
  );
}

export const ClipPage = memo(ClipPageComponent);

const styles = StyleSheet.create({
  page: { backgroundColor: colors.black, overflow: "hidden" },
  centerPlayIcon: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  fastForwardBadge: {
    position: "absolute",
    top: 96,
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  fullScreenButtonRow: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  bottomChrome: { position: "absolute", left: 0, right: 0, bottom: 0 },
  seekBar: { position: "absolute", left: 0, right: 0 },
  hiddenWhileScrubbing: { opacity: 0 },
});
