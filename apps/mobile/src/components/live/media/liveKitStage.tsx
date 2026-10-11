import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";
import type { TrackReference } from "@livekit/react-native";

import { SpeakerHigh24Icon, SpeakerSlash24Icon } from "@/components/icons";
import { BrandLoader } from "@/components/ui/brandLoader";
import { Text } from "@/components/ui/text";
import type { LiveSessionDetails } from "@/types";

import { LiveKitVideo } from "./liveKitVideo";
import type { LiveMedia } from "./liveMedia.hook";
import { readLiveKitStageState, type LiveKitStageState } from "./liveKitStage.util";

const STATE_COPY: Readonly<Record<LiveKitStageState, string>> = {
  video: "",
  connecting: "",
  waitingForHost: "Waiting for the host's video…",
  cameraOff: "Camera is off",
  unavailable: "Video isn't available right now",
};

export function LiveKitStage({ session, media, isPublisher }: { session: LiveSessionDetails; media: LiveMedia; isPublisher: boolean }) {
  const state = readLiveKitStageState(media, isPublisher, session.host.id);
  const video: TrackReference | undefined = isPublisher ? media.host.cameraTrackRef : media.viewer.hostVideo;
  const runtime = media.connection.runtime;
  if (state === "video" && video && runtime) {
    return <LiveKitVideo runtime={runtime} trackRef={video} isMirrored={isPublisher && media.host.facing === "user"} />;
  }
  return (
    <View style={StyleSheet.absoluteFill} testID={`live-stage-${state}`}>
      <Image source={{ uri: session.coverUrl ?? session.host.avatarUrl ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={state === "cameraOff" ? 0 : 12} />
      <View style={styles.dim} />
      <View style={styles.center}>
        {state === "connecting" ? (
          <BrandLoader size="lg" accessibilityLabel={isPublisher ? "Starting your video" : "Loading the live video"} />
        ) : (
          <Text size={14} weight={600} lineHeight={18} color="#FFFFFF" align="center">{STATE_COPY[state]}</Text>
        )}
      </View>
    </View>
  );
}

export function LiveViewerMediaControls({ media, topOffset }: { media: LiveMedia; topOffset: number }) {
  if (media.mode !== "livekit") return null;
  const { status, retry } = media.connection;
  if (status === "failed" || status === "removed" || status === "unavailable") {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Try loading the video again" onPress={retry} style={[styles.pill, { top: topOffset }]}>
        <Text size={13} weight={600} lineHeight={17} color="#FFFFFF">Video unavailable. Tap to retry</Text>
      </Pressable>
    );
  }
  if (!media.viewer.hostVideo) return null;
  const isMuted = media.viewer.isAudioMuted;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={isMuted ? "Unmute live" : "Mute live"} onPress={media.viewer.toggleAudio} style={[styles.pill, { top: topOffset }]} testID="live-viewer-audio-toggle">
      {isMuted ? <SpeakerSlash24Icon size={18} color="#FFFFFF" /> : <SpeakerHigh24Icon size={18} color="#FFFFFF" />}
      {isMuted ? <Text size={13} weight={600} lineHeight={17} color="#FFFFFF">Tap to unmute</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.35)" },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  pill: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(16,16,24,0.72)", zIndex: 6 },
});
