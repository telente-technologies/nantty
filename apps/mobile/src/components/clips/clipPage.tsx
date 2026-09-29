import { Image } from "expo-image";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors } from "@/constants/colors.constant";
import type { Clip } from "@/types";

import { ClipActionRail } from "./clipActionRail";
import { ClipCommentBar } from "./clipCommentBar";
import { ClipDetails } from "./clipDetails";
import { ClipPlaybackControls } from "./clipPlaybackControls";
import { LikeBurst } from "./likeBurst";

export interface ClipEngagement {
  readonly liked: boolean;
  readonly likes: number;
  readonly isFollowing: boolean;
}

export interface ClipPageProps {
  readonly clip: Clip;
  readonly height: number;
  readonly engagement: ClipEngagement;
  readonly myAvatarUrl: string | null;
  readonly onToggleLike: () => void;
  readonly onLikeByDoubleTap: () => void;
  readonly onToggleFollow: () => void;
  readonly onOpenComments: () => void;
  readonly onShare: () => void;
  readonly onPressAuthor: () => void;
}

const DOUBLE_TAP_WINDOW_MS = 280;

export function ClipPage(props: ClipPageProps) {
  const { clip, engagement } = props;
  const [showPlaybackControls, setShowPlaybackControls] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const lastTapAt = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cover = clip.media[0]?.url ?? null;

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
    singleTapTimer.current = setTimeout(() => setShowPlaybackControls((shown) => !shown), DOUBLE_TAP_WINDOW_MS);
  };

  return (
    <View style={[styles.page, { height: props.height }]}>
      <Pressable
        accessibilityLabel="Clip. Tap to show playback controls, double tap to like"
        onPress={handleTapOnClipMedia}
        style={styles.media}
      >
        {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <LikeBurst burstKey={burstKey} />
      </Pressable>
      <View style={styles.overlay} pointerEvents="box-none">
        <ClipDetails
          clip={clip}
          isFollowing={engagement.isFollowing}
          onToggleFollow={props.onToggleFollow}
          onPressAuthor={props.onPressAuthor}
        />
        <ClipActionRail
          liked={engagement.liked}
          likes={engagement.likes}
          comments={clip.comments}
          shares={clip.views}
          onToggleLike={props.onToggleLike}
          onOpenComments={props.onOpenComments}
          onShare={props.onShare}
          onMore={() => undefined}
        />
      </View>
      {showPlaybackControls ? (
        <ClipPlaybackControls
          remainingSeconds={clip.durationSeconds}
          progress={0.87}
          onPressPlay={() => setShowPlaybackControls(false)}
          onPressSpeed={() => undefined}
          onPressVolume={() => undefined}
          onPressFullscreen={() => undefined}
        />
      ) : (
        <ClipCommentBar myAvatarUrl={props.myAvatarUrl} onPress={props.onOpenComments} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.white },
  media: { flex: 1, backgroundColor: colors.white },
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 76,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
});
