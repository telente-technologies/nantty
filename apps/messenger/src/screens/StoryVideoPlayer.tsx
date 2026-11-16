import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { Pause, Play, SpeakerHigh, SpeakerSlash } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Image, Pressable, StyleSheet, Text, View, type ImageStyle } from "react-native";

import { useMessengerColors } from "../ui/useMessengerColors";

interface StoryVideoPlayerProps {
  readonly url: string;
  readonly posterUrl: string | null;
  readonly authorName: string;
}

export function StoryVideoPlayer({ url, posterUrl, authorName }: StoryVideoPlayerProps) {
  const colors = useMessengerColors();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [pausedByUser, setPausedByUser] = useState(false);
  const [muted, setMuted] = useState(true);
  const [hasRenderedFrame, setHasRenderedFrame] = useState(false);
  const player = useVideoPlayer(url, (createdPlayer) => {
    createdPlayer.loop = true;
    createdPlayer.muted = true;
  });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setAppActive(state === "active"));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (appActive && !pausedByUser && status !== "error") player.play();
    else player.pause();
    return () => player.pause();
  }, [appActive, pausedByUser, player, status]);

  return (
    <View style={[styles.root, { backgroundColor: colors.scrim }]}>
      <VideoView
        accessibilityLabel={`${authorName}'s video Story`}
        allowsPictureInPicture={false}
        contentFit="cover"
        nativeControls={false}
        onFirstFrameRender={() => setHasRenderedFrame(true)}
        player={player}
        style={StyleSheet.absoluteFill}
      />
      {!hasRenderedFrame && posterUrl ? <Image accessibilityLabel="Video Story preview" source={{ uri: posterUrl }} resizeMode="cover" style={StyleSheet.absoluteFill as ImageStyle} /> : null}
      {status === "error" ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.onBrand }]}>This video Story could not be played.</Text> : null}
      {status === "loading" && !hasRenderedFrame ? <ActivityIndicator accessibilityLabel="Loading video Story" color={colors.onBrand} style={styles.loading} /> : null}
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? "Pause video Story" : "Play video Story"}
          accessibilityState={{ disabled: status === "error" }}
          disabled={status === "error"}
          onPress={() => setPausedByUser(isPlaying)}
          style={styles.controlButton}
        >
          {isPlaying ? <Pause size={20} color={colors.onBrand} weight="fill" /> : <Play size={20} color={colors.onBrand} weight="fill" />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={muted ? "Unmute video Story" : "Mute video Story"} onPress={() => setMuted((current) => !current)} style={styles.controlButton}>
          {muted ? <SpeakerSlash size={19} color={colors.onBrand} /> : <SpeakerHigh size={19} color={colors.onBrand} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 180, overflow: "hidden", borderRadius: 16 },
  controls: { position: "absolute", left: 10, right: 10, bottom: 10, flexDirection: "row", justifyContent: "space-between" },
  controlButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.58)", alignItems: "center", justifyContent: "center" },
  loading: { position: "absolute", alignSelf: "center", top: "48%" },
  message: { position: "absolute", top: 12, left: 12, right: 12, textAlign: "center", fontSize: 13 },
});
