import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Plus16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import type { LiveSessionDetails } from "@/types";
import type { LiveStage, LiveStageStreamer } from "@/types/liveStage.type";

import { liveGlass } from "../liveSurface.constant";
import { buildBattleBadgeForStreamer } from "../battle/battleStandings.util";
import type { LiveMedia } from "../media/liveMedia.hook";
import { LiveStageTile } from "./liveStageTile";
import { computeStageTileFramesForStreamerCount, stageGridHeightForWidth } from "./stageGridLayout.util";

export interface LiveStageGridProps {
  readonly stage: LiveStage;
  readonly session: LiveSessionDetails;
  readonly signedInUserId: string | null;
  readonly maximumHeight: number;
  readonly isCameraPermissionGranted: boolean;
  readonly isPlaybackAllowed: boolean;
  readonly tilePressHint: string;
  readonly onPressStreamer: (streamer: LiveStageStreamer) => void;
  readonly onPressEmptySeat?: () => void;
  readonly overlay?: ReactNode;
  readonly media?: LiveMedia;
}

export function LiveStageGrid(props: LiveStageGridProps) {
  const [width, setWidth] = useState(0);
  const { streamers, activeBattle: battle } = props.stage;
  const height = stageGridHeightForWidth(streamers.length, width, props.maximumHeight);
  const { frames, emptySeatCount } = computeStageTileFramesForStreamerCount(streamers.length, width, height);
  return (
    <View style={[styles.grid, { height }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0
        ? streamers.map((streamer, index) => (
            <LiveStageTile
              key={streamer.user.id}
              streamer={streamer}
              frame={frames[index]!}
              session={props.session}
              isMe={streamer.user.id === props.signedInUserId}
              isCameraPermissionGranted={props.isCameraPermissionGranted}
              isPlaybackAllowed={props.isPlaybackAllowed}
              media={props.media}
              battleBadge={buildBattleBadgeForStreamer(battle, streamer.user.id)}
              pressHint={props.tilePressHint}
              onPress={() => props.onPressStreamer(streamer)}
            />
          ))
        : null}
      {width > 0
        ? frames.slice(streamers.length, streamers.length + emptySeatCount).map((frame, index) => (
            <Pressable
              key={`empty_${index}`}
              accessibilityRole="button"
              accessibilityLabel={props.onPressEmptySeat ? "Invite a guest to this seat" : "Empty seat"}
              disabled={!props.onPressEmptySeat}
              onPress={props.onPressEmptySeat}
              style={[styles.emptySeat, { left: frame.left, top: frame.top, width: frame.width, height: frame.height }]}
            >
              {props.onPressEmptySeat ? <Plus16Icon color={liveGlass.ink} /> : null}
              <Text size={10} lineHeight={12} color={liveGlass.inkMuted}>
                {props.onPressEmptySeat ? "Invite" : "Empty seat"}
              </Text>
            </Pressable>
          ))
        : null}
      {props.overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { width: "100%", position: "relative" },
  emptySeat: {
    position: "absolute",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    borderColor: liveGlass.border,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
});
