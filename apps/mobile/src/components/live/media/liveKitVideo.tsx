import { StyleSheet, type ViewStyle } from "react-native";
import type { TrackReference } from "@livekit/react-native";

import type { LiveKitRuntime } from "@/services/live/liveKitRuntime.service";

export interface LiveKitVideoProps {
  readonly runtime: LiveKitRuntime;
  readonly trackRef: TrackReference;
  readonly isMirrored?: boolean;
  readonly style?: ViewStyle;
}

export function LiveKitVideo({ runtime, trackRef, isMirrored = false, style }: LiveKitVideoProps) {
  const { VideoTrack } = runtime.native;
  return <VideoTrack trackRef={trackRef} style={style ?? StyleSheet.absoluteFill} objectFit="cover" mirror={isMirrored} />;
}
