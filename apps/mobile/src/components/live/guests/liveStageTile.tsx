import { CameraView } from "expo-camera";
import { Image } from "expo-image";
import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { Microphone24Icon } from "@/components/icons";
import { ClipVideoPlayer } from "@/components/media/clipVideoPlayer";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import type { LiveSessionDetails, Media } from "@/types";
import type { LiveBattleParticipant, LiveStageStreamer } from "@/types/liveStage.type";

import { liveAccent, liveGlass, liveReadableTextShadow } from "../liveSurface.constant";
import { LiveKitVideo } from "../media/liveKitVideo";
import type { LiveMedia } from "../media/liveMedia.hook";
import { findStreamerVideo } from "../media/liveViewerMedia.hook";
import type { StageTileFrame } from "./stageGridLayout.util";
import { Coin24Icon, Crown24Icon, MicrophoneSlash24Icon } from "@/components/icons";
import { IconRow } from "@/components/ui/iconRow";

export interface LiveStageTileBattleBadge {
  readonly participant: LiveBattleParticipant;
  readonly rank: number | null;
  readonly isWinner: boolean;
  readonly isDimmed: boolean;
}

export interface LiveStageTileProps {
  readonly streamer: LiveStageStreamer;
  readonly frame: StageTileFrame;
  readonly session: LiveSessionDetails;
  readonly isMe: boolean;
  readonly isCameraPermissionGranted: boolean;
  readonly isPlaybackAllowed: boolean;
  readonly battleBadge: LiveStageTileBattleBadge | null;
  readonly onPress: () => void;
  readonly pressHint: string;
  readonly media?: LiveMedia;
}

function StreamerTileMedia({ streamer, session, isMe, isCameraPermissionGranted, isPlaybackAllowed, frame, media }: LiveStageTileProps) {
  const hostStreamMedia = useMemo<Media | null>(
    () => (session.playbackUrl ? { type: "video", url: session.playbackUrl, posterUrl: session.coverUrl ?? null } : null),
    [session.playbackUrl, session.coverUrl],
  );
  const avatarSize = Math.min(64, frame.width * 0.4);
  if (streamer.videoMuted) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.cameraOff]}>
        <Avatar uri={streamer.user.avatarUrl} size={avatarSize} />
        <Text size={11} color={liveGlass.ink} lineHeight={14}>
          Camera off
        </Text>
      </View>
    );
  }
  const liveKitVideo = media?.mode === "livekit" ? findStreamerVideo(media.connection, streamer.user.id) : undefined;
  if (liveKitVideo && media?.connection.runtime) {
    return <LiveKitVideo runtime={media.connection.runtime} trackRef={liveKitVideo} isMirrored={isMe && media.host.facing === "user"} />;
  }
  if (isMe && isCameraPermissionGranted && media?.mode !== "livekit") return <CameraView style={StyleSheet.absoluteFill} facing="front" />;
  if (streamer.role === "host" && !isMe && hostStreamMedia) {
    return <ClipVideoPlayer media={hostStreamMedia} isActive={isPlaybackAllowed} isMuted={Platform.OS === "web"} style={StyleSheet.absoluteFill} />;
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={{ uri: streamer.user.avatarUrl ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={18} />
      <View style={styles.centeredAvatar}>
        <Avatar uri={streamer.user.avatarUrl} size={avatarSize} />
      </View>
    </View>
  );
}

function TileBattleBadges({ battleBadge }: { battleBadge: LiveStageTileBattleBadge }) {
  const { participant, rank, isWinner } = battleBadge;
  return (
    <>
      <View style={styles.scoreRow}>
        {rank !== null ? (
          <View style={[styles.rankChip, rank === 1 ? styles.rankChipLeader : null]}>
            <Text size={10} weight={700} lineHeight={12} color={rank === 1 ? liveAccent.goldInk : liveGlass.ink}>
              #{rank}
            </Text>
          </View>
        ) : null}
        <View style={styles.scoreChip}>
          <IconRow icon={<Coin24Icon size={13} />} gap={3}>
            <Text size={11} weight={700} lineHeight={13} color={liveGlass.ink}>
              {participant.score.toLocaleString("en-US")}
            </Text>
          </IconRow>
        </View>
      </View>
      {isWinner ? (
        <View style={styles.winnerBadge} pointerEvents="none">
          <Crown24Icon size={32} color={liveAccent.gold} />
          <View style={styles.mvpChip}>
            <Text size={10} weight={700} lineHeight={12} color={liveAccent.goldInk}>
              MVP
            </Text>
          </View>
        </View>
      ) : null}
      {participant.state !== "active" ? (
        <View style={styles.forfeitChip}>
          <Text size={10} weight={600} lineHeight={12} color={liveGlass.ink}>
            Left · forfeited
          </Text>
        </View>
      ) : null}
    </>
  );
}

export function LiveStageTile(props: LiveStageTileProps) {
  const { streamer, frame, battleBadge } = props;
  const label = `${streamer.user.name}${streamer.role === "host" ? ", host" : ""}, mic ${streamer.audioMuted ? "muted" : "on"}${
    battleBadge ? `, ${battleBadge.participant.score} coins` : ""
  }`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={props.pressHint}
      onPress={props.onPress}
      style={[styles.tile, { left: frame.left, top: frame.top, width: frame.width, height: frame.height }, battleBadge?.isWinner ? styles.winnerTile : null]}
    >
      <StreamerTileMedia {...props} />
      {battleBadge ? <TileBattleBadges battleBadge={battleBadge} /> : null}
      <View style={styles.nameRow} pointerEvents="none">
        {!streamer.audioMuted ? (
          <Microphone24Icon size={12} color={liveGlass.ink} />
        ) : (
          <MicrophoneSlash24Icon size={12} color={liveGlass.ink} />
        )}
        <Text size={11} weight={600} lineHeight={13} color={liveGlass.ink} numberOfLines={1} style={styles.nameText}>
          {props.isMe ? "You" : streamer.user.name}
        </Text>
        {streamer.role === "host" || streamer.title?.trim() || streamer.stageRole === "cohost" ? (
          <View style={styles.hostChip}>
            <Text size={9} weight={700} lineHeight={11} color={liveGlass.ink}>
              {streamer.role === "host" ? "HOST" : streamer.title?.trim() || "CO-HOST"}
            </Text>
          </View>
        ) : null}
      </View>
      {battleBadge?.isDimmed ? <View style={styles.dimmed} pointerEvents="none" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { position: "absolute", overflow: "hidden", backgroundColor: "#0A0A0C", borderRadius: 10 },
  winnerTile: { borderWidth: 2, borderColor: liveAccent.gold },
  cameraOff: { alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#2A2A2E" },
  centeredAvatar: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  nameRow: { position: "absolute", left: 6, right: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  nameText: { flexShrink: 1, ...liveReadableTextShadow },
  hostChip: { backgroundColor: liveAccent.red, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  scoreRow: { position: "absolute", top: 6, left: 6, flexDirection: "row", gap: 4, alignItems: "center" },
  rankChip: { backgroundColor: liveGlass.backgroundStrong, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  rankChipLeader: { backgroundColor: liveAccent.gold },
  scoreChip: { backgroundColor: liveGlass.backgroundStrong, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  winnerBadge: { position: "absolute", top: 4, right: 6, alignItems: "center" },
  mvpChip: { backgroundColor: liveAccent.gold, borderRadius: 6, paddingHorizontal: 5, marginTop: -4 },
  forfeitChip: { position: "absolute", top: "45%", alignSelf: "center", backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  dimmed: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
});
