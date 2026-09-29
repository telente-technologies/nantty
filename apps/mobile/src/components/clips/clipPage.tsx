import { memo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Play24Icon } from "@/components/icons";
import { ClipVideoPlayer, VideoPosterOnly, type VideoPlaybackProgress } from "@/components/media/clipVideoPlayer";
import { isContentLockedForViewer, SubscriberOnlyLock } from "@/components/coins/subscriberOnlyLock";
import { TipSheet } from "@/components/coins/tipSheet";
import { ContentOptionsSheet } from "@/components/moderation/contentOptionsSheet";
import { colors } from "@/constants/colors.constant";
import { useAuthStore } from "@/store/auth.store";
import type { Clip } from "@/types";

import { ClipActionRail } from "./clipActionRail";
import { ClipCommentBar } from "./clipCommentBar";
import { ClipDetails } from "./clipDetails";
import { ClipPlaybackControls } from "./clipPlaybackControls";
import { ClipReadabilityScrim } from "./clipReadabilityScrim";
import { LikeBurst } from "./likeBurst";

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
}

const DOUBLE_TAP_WINDOW_MS = 280;
const COMMENT_BAR_HEIGHT = 50;
const PLAYBACK_SPEED_STEPS = [1, 1.5, 2, 0.5] as const;
const FOREGROUND_ON_VIDEO = colors.white;

function ClipPageComponent(props: ClipPageProps) {
  const { clip, engagement, isActive } = props;
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState<VideoPlaybackProgress>({ currentSeconds: 0, durationSeconds: clip.durationSeconds });
  const [playbackSpeedStepIndex, setPlaybackSpeedStepIndex] = useState(0);
  const [isOptionsSheetOpen, setIsOptionsSheetOpen] = useState(false);
  const [hasOpenedOptionsSheet, setHasOpenedOptionsSheet] = useState(false);
  const openClipOptions = () => {
    setHasOpenedOptionsSheet(true);
    setIsOptionsSheetOpen(true);
  };
  const lastTapAt = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const video = clip.media.find((item) => item.type === "video") ?? clip.media[0];
  const signedInUserId = useAuthStore((state) => state.user?.id ?? null);
  const [isTipSheetOpen, setIsTipSheetOpen] = useState(false);
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
    singleTapTimer.current = setTimeout(() => setIsPausedByUser((paused) => !paused), DOUBLE_TAP_WINDOW_MS);
  };

  const showPlaybackControls = isActive && isPausedByUser;
  const durationSeconds = playbackProgress.durationSeconds || clip.durationSeconds;
  const bottomChromeHeight = COMMENT_BAR_HEIGHT + props.bottomInset;

  return (
    <View style={[styles.page, { height: props.height }]}>
      <Pressable
        accessibilityLabel={isPausedByUser ? "Clip paused. Tap to play, double tap to like" : "Clip. Tap to pause, double tap to like"}
        onPress={handleTapOnClipMedia}
        style={StyleSheet.absoluteFill}
      >
        {isClipLockedForViewer ? (
          <SubscriberOnlyLock creatorId={clip.author.id} creatorName={clip.author.name} blurredPreviewUrl={video?.posterUrl ?? null} />
        ) : video && props.shouldMountVideoPlayer ? (
          <ClipVideoPlayer
            media={video}
            isActive={isActive}
            isMuted={props.isMuted}
            isPausedByUser={isPausedByUser}
            playbackRate={PLAYBACK_SPEED_STEPS[playbackSpeedStepIndex]}
            onPlaybackProgress={isActive ? setPlaybackProgress : undefined}
            style={StyleSheet.absoluteFill}
          />
        ) : video ? (
          <VideoPosterOnly media={video} style={StyleSheet.absoluteFill} />
        ) : null}
        <ClipReadabilityScrim edge="top" height={props.topInset + 96} />
        <ClipReadabilityScrim edge="bottom" height={bottomChromeHeight + 260} />
        {showPlaybackControls ? (
          <View pointerEvents="none" style={styles.centerPlayIcon}>
            <Play24Icon size={48} color={FOREGROUND_ON_VIDEO} />
          </View>
        ) : null}
        <LikeBurst burstKey={burstKey} />
      </Pressable>
      <View style={[styles.overlay, { bottom: bottomChromeHeight + 16 }]} pointerEvents="box-none">
        <ClipDetails
          clip={clip}
          isFollowing={engagement.isFollowing}
          onToggleFollow={props.onToggleFollow}
          onPressAuthor={props.onPressAuthor}
          foregroundColor={FOREGROUND_ON_VIDEO}
        />
        <ClipActionRail
          liked={engagement.liked}
          likes={engagement.likes}
          comments={clip.comments}
          shares={clip.views}
          onToggleLike={props.onToggleLike}
          onOpenComments={props.onOpenComments}
          onShare={props.onShare}
          onMore={openClipOptions}
          onTip={canTipAuthor ? () => setIsTipSheetOpen(true) : undefined}
          foregroundColor={FOREGROUND_ON_VIDEO}
        />
      </View>
      <View style={[styles.bottomChrome, { paddingBottom: props.bottomInset }]}>
        {showPlaybackControls ? (
          <ClipPlaybackControls
            remainingSeconds={Math.max(durationSeconds - playbackProgress.currentSeconds, 0)}
            progress={durationSeconds > 0 ? playbackProgress.currentSeconds / durationSeconds : 0}
            isMuted={props.isMuted}
            playbackSpeed={PLAYBACK_SPEED_STEPS[playbackSpeedStepIndex]}
            onPressPlay={() => setIsPausedByUser(false)}
            onPressSpeed={() => setPlaybackSpeedStepIndex((index) => (index + 1) % PLAYBACK_SPEED_STEPS.length)}
            onPressVolume={props.onToggleMute}
            onPressFullscreen={() => setIsPausedByUser(false)}
          />
        ) : (
          <ClipCommentBar myAvatarUrl={props.myAvatarUrl} onPress={props.onOpenComments} />
        )}
      </View>
      {hasOpenedOptionsSheet ? (
        <ContentOptionsSheet
          target={
            isOptionsSheetOpen
              ? { targetType: "clip", targetId: clip.id, authorId: clip.author.id, shareUrl: `https://zudomart.com/clips/${clip.id}` }
              : null
          }
          onClose={() => setIsOptionsSheetOpen(false)}
        />
      ) : null}
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
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  bottomChrome: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.white },
});
