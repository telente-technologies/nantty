import { CameraView } from "expo-camera";
import { Image } from "expo-image";
import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { Microphone24Icon } from "@/components/icons";
import { ClipVideoPlayer } from "@/components/media/clipVideoPlayer";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { LiveSessionDetails, Media } from "@/types";
import type { LiveBattleParticipant, LiveStageStreamer } from "@/types/liveStage.type";

import type { StageTileFrame } from "./stageGridLayout.util";

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
}

function StreamerTileMedia({ streamer, session, isMe, isCameraPermissionGranted, isPlaybackAllowed, frame }: LiveStageTileProps) {
  const hostStreamMedia = useMemo<Media | null>(
    () => (session.playbackUrl ? { type: "video", url: session.playbackUrl, posterUrl: session.coverUrl ?? null } : null),
    [session.playbackUrl, session.coverUrl],
  );
  const avatarSize = Math.min(64, frame.width * 0.4);
  if (streamer.videoMuted) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.cameraOff]}>
        <Avatar uri={streamer.user.avatarUrl} size={avatarSize} />
        <Text size={11} color={colors.white} lineHeight={14}>
          Camera off
        </Text>
      </View>
    );
  }
  if (isMe && isCameraPermissionGranted) return <CameraView style={StyleSheet.absoluteFill} facing="front" />;
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
            <Text size={10} weight={700} lineHeight={12} color={rank === 1 ? colors.black : colors.white}>
              #{rank}
            </Text>
          </View>
        ) : null}
        <View style={styles.scoreChip}>
          <Text size={11} weight={700} lineHeight={13} color={colors.white}>
            🪙 {participant.score.toLocaleString("en-US")}
          </Text>
        </View>
      </View>
      {isWinner ? (
        <View style={styles.winnerBadge} pointerEvents="none">
          <Text size={28} lineHeight={32}>
            👑
          </Text>
          <View style={styles.mvpChip}>
            <Text size={10} weight={700} lineHeight={12} color={colors.black}>
              MVP
            </Text>
          </View>
        </View>
      ) : null}
      {participant.state !== "active" ? (
        <View style={styles.forfeitChip}>
          <Text size={10} weight={600} lineHeight={12} color={colors.white}>
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
          <Microphone24Icon size={12} color={colors.white} />
        ) : (
          <Text size={10} lineHeight={12}>
            🔇
          </Text>
        )}
        <Text size={11} weight={600} lineHeight={13} color={colors.white} numberOfLines={1} style={styles.nameText}>
          {props.isMe ? "You" : streamer.user.name}
        </Text>
        {streamer.role === "host" ? (
          <View style={styles.hostChip}>
            <Text size={9} weight={700} lineHeight={11} color={colors.white}>
              HOST
            </Text>
          </View>
        ) : null}
      </View>
      {battleBadge?.isDimmed ? <View style={styles.dimmed} pointerEvents="none" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { position: "absolute", overflow: "hidden", backgroundColor: colors.media, borderRadius: 6 },
  winnerTile: { borderWidth: 2, borderColor: "#FFD54A" },
  cameraOff: { alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#2A2A2E" },
  centeredAvatar: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  nameRow: { position: "absolute", left: 6, right: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  nameText: { flexShrink: 1, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3 },
  hostChip: { backgroundColor: colors.live, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  scoreRow: { position: "absolute", top: 6, left: 6, flexDirection: "row", gap: 4, alignItems: "center" },
  rankChip: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  rankChipLeader: { backgroundColor: "#FFD54A" },
  scoreChip: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  winnerBadge: { position: "absolute", top: 4, right: 6, alignItems: "center" },
  mvpChip: { backgroundColor: "#FFD54A", borderRadius: 6, paddingHorizontal: 5, marginTop: -4 },
  forfeitChip: { position: "absolute", top: "45%", alignSelf: "center", backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  dimmed: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
});
