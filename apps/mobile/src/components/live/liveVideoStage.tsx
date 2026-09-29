import { CameraView } from "expo-camera";
import { Image } from "expo-image";
import { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { ClipReadabilityScrim } from "@/components/clips/clipReadabilityScrim";
import { ClipVideoPlayer } from "@/components/media/clipVideoPlayer";
import type { LiveSessionDetails, Media } from "@/types";

const TOP_SCRIM_HEIGHT = 160;
const BOTTOM_SCRIM_HEIGHT = 320;

export interface LiveVideoStageProps {
  readonly session: LiveSessionDetails;
  readonly isHost: boolean;
  readonly isHostCameraAllowed: boolean;
  readonly isPlaybackAllowed: boolean;
}

export const doesLiveStageShowVideo = (session: LiveSessionDetails, isHost: boolean, isHostCameraAllowed: boolean) =>
  isHost ? isHostCameraAllowed : !!(session.playbackUrl ?? session.coverUrl);

export function LiveVideoStage({ session, isHost, isHostCameraAllowed, isPlaybackAllowed }: LiveVideoStageProps) {
  const liveStreamMedia = useMemo<Media | null>(
    () => (session.playbackUrl ? { type: "video", url: session.playbackUrl, posterUrl: session.coverUrl ?? null } : null),
    [session.playbackUrl, session.coverUrl],
  );
  if (!doesLiveStageShowVideo(session, isHost, isHostCameraAllowed)) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {isHost ? (
        <CameraView style={StyleSheet.absoluteFill} facing="front" />
      ) : liveStreamMedia ? (
        <ClipVideoPlayer media={liveStreamMedia} isActive={isPlaybackAllowed} isMuted={Platform.OS === "web"} style={StyleSheet.absoluteFill} />
      ) : (
        <Image source={{ uri: session.coverUrl ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      <ClipReadabilityScrim edge="top" height={TOP_SCRIM_HEIGHT} />
      <ClipReadabilityScrim edge="bottom" height={BOTTOM_SCRIM_HEIGHT} />
    </View>
  );
}
