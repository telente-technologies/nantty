import { memo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { BoxArrowDown24Icon, Play24Icon } from "@/components/icons";
import { ClipLookOverlay, isClipLookId } from "@/components/create/clip/clipLook.constant";
import { Text } from "@/components/ui/text";
import { ClipVideoPlayer, VideoPosterOnly, type VideoPlaybackProgress } from "@/components/media/clipVideoPlayer";
import { LandscapeVideoFullScreenModal } from "@/components/media/landscapeVideoFullScreenModal";
import { isLandscapeMedia } from "@/components/media/videoOrientation.util";
import { ViewFullScreenButton } from "@/components/media/viewFullScreenButton";
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
import { ClipPlaybackControls } from "./clipPlaybackControls";
import { ClipReadabilityScrim } from "./clipReadabilityScrim";
import { LikeBurst } from "./likeBurst";
import { CommentStickerOverlay } from "./videoReply/commentStickerOverlay";
import { PromotedLiveOverlay } from "./promotedLiveOverlay";
import { webAppLinks } from "@/config/webAppLinks.config";
import { TaggedPeopleSheet } from "@/components/taggedPeople/taggedPeopleSheet";

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

const DOUBLE_TAP_WINDOW_MS = 280;
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
  const lastTapAt = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const video = clip.media.find((item) => item.type === "video") ?? clip.media[0];
  const isLandscapeVideo = isLandscapeMedia(video);
  const { width: windowWidth } = useWindowDimensions();
  const letterboxedVideoHeight = video?.width && video.height ? (windowWidth * video.height) / video.width : (windowWidth * 9) / 16;
  const [isFullScreenPlayerOpen, setIsFullScreenPlayerOpen] = useState(false);
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const [isTipSheetOpen, setIsTipSheetOpen] = useState(false);
  const [isTaggedSheetOpen, setIsTaggedSheetOpen] = useState(false);
  const canTipAuthor = clip.author.isCreator === true && clip.author.id !== signedInUserId;
  const isClipLockedForViewer = isContentLockedForViewer(clip);

  const handleTapOnClipMedia = () => {
    const now = Date.now();
    if (now - lastTapAt.current < DOUBLE_TAP_WINDOW_MS) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      lastTapAt.current = 0;
      setBurstKey((k) => k + 1);
      props.onLikeByDoubleTap();
      return;
    }
    lastTapAt.current = now;
    singleTapTimer.current = setTimeout(() => {
      if (clip.promotedLive && props.onOpenPromotedLive) props.onOpenPromotedLive(clip.promotedLive.liveSessionId);
      else setIsPausedByUser((paused) => !paused);
    }, DOUBLE_TAP_WINDOW_MS);
  };

  const showPlaybackControls = isActive && isPausedByUser;
  const durationSeconds = playbackProgress.durationSeconds || clip.durationSeconds;
  const overlayBottomOffset = props.bottomInset + 16;

  return (
    <View style={[styles.page, { height: props.height }]}>
      <Pressable
        accessibilityLabel={isPausedByUser ? "Clip paused. Tap to play, double tap to like, hold to play at 2x" : "Clip. Tap to pause, double tap to like, hold to play at 2x"}
        onPress={handleTapOnClipMedia}
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
            isPausedByUser={isPausedByUser || isTaggedSheetOpen}
            playbackRate={isHeldForFastForward ? 2 : PLAYBACK_SPEED_STEPS[playbackSpeedStepIndex]}
            onPlaybackProgress={isActive ? setPlaybackProgress : undefined}
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
      <View style={[styles.overlay, { bottom: overlayBottomOffset }]} pointerEvents="box-none">
        <ClipDetails
          isActive={isActive}
          clip={clip}
          isFollowing={engagement.isFollowing}
          onToggleFollow={props.onToggleFollow}
          onPressAuthor={props.onPressAuthor}
          foregroundColor={FOREGROUND_ON_VIDEO}
          onOpenTaggedPeople={() => setIsTaggedSheetOpen(true)}
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
          onTip={canTipAuthor ? () => setIsTipSheetOpen(true) : undefined}
          saveTarget={{ type: "clip", targetId: clip.id }}
          savedAccordingToServer={clip.bookmarked}
          saveCount={clip.saveCount ?? 0}
          foregroundColor={FOREGROUND_ON_VIDEO}
          minimal={!!clip.sponsored}
        />
      </View>
      {showPlaybackControls ? (
        <View style={[styles.bottomChrome, { paddingBottom: props.bottomInset, backgroundColor: themeColors.surface }]}>
          <ClipPlaybackControls
            remainingSeconds={Math.max(durationSeconds - playbackProgress.currentSeconds, 0)}
            progress={durationSeconds > 0 ? playbackProgress.currentSeconds / durationSeconds : 0}
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
          additionalActions={downloadableVideo ? [{ label: "Download", icon: <BoxArrowDown24Icon size={20} />, onPress: () => requireAuthThen(() => startBrandedDownload(clip.id, downloadableVideo), null, "download") }] : undefined}
        />
      ) : null}
      <LandscapeVideoFullScreenModal
        media={isFullScreenPlayerOpen && video ? video : null}
        saveTarget={{ type: "clip", targetId: clip.id }}
        savedAccordingToServer={clip.bookmarked}
        isMuted={props.isMuted}
        onClose={() => setIsFullScreenPlayerOpen(false)}
        look={clip.look}
      />
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
});
