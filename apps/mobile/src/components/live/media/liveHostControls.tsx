import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CameraRotate24Icon, Microphone24Icon, MicrophoneSlash24Icon, VideoCamera24Icon, VideoCameraSlash24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import type { LiveConnectionQuality } from "@/services/live/liveMediaPolicy.util";

import type { LiveHostMedia } from "./liveHostMedia.hook";

export interface LiveHostControlsProps {
  readonly media: LiveHostMedia;
  readonly quality: LiveConnectionQuality;
  readonly topOffset: number;
}

const QUALITY_COLORS: Readonly<Record<LiveConnectionQuality, string>> = {
  excellent: "#2BD97C",
  good: "#2BD97C",
  poor: "#FFB020",
  lost: "#FF4D4F",
  unknown: "#9A9AA5",
};

const QUALITY_LABELS: Readonly<Record<LiveConnectionQuality, string>> = {
  excellent: "Excellent connection",
  good: "Good connection",
  poor: "Weak connection",
  lost: "Connection lost",
  unknown: "Checking connection",
};

const QUALITY_SHORT: Readonly<Record<LiveConnectionQuality, string>> = { excellent: "Good", good: "Good", poor: "Weak", lost: "Lost", unknown: "…" };

function ControlButton({ label, onPress, children, isOff = false }: { label: string; onPress: () => void; children: ReactNode; isOff?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: isOff }} hitSlop={6} onPress={onPress} style={[styles.button, isOff ? styles.buttonOff : null]}>
      {children}
    </Pressable>
  );
}

export function LiveHostControls({ media, quality, topOffset }: LiveHostControlsProps) {
  return (
    <View style={[styles.column, { top: topOffset }]} testID="live-host-controls">
      <View style={styles.quality} accessibilityLabel={QUALITY_LABELS[quality]} accessibilityRole="text">
        <View style={[styles.qualityDot, { backgroundColor: QUALITY_COLORS[quality] }]} />
        <Text size={10} weight={600} lineHeight={12} color="#FFFFFF">{QUALITY_SHORT[quality]}</Text>
      </View>
      <ControlButton label={media.facing === "user" ? "Switch to back camera" : "Switch to front camera"} onPress={media.flipCamera}>
        <CameraRotate24Icon size={20} color="#FFFFFF" />
      </ControlButton>
      <ControlButton label={media.isMicOn ? "Mute microphone" : "Unmute microphone"} onPress={media.toggleMic} isOff={!media.isMicOn}>
        {media.isMicOn ? <Microphone24Icon size={20} color="#FFFFFF" /> : <MicrophoneSlash24Icon size={20} color="#FFFFFF" />}
      </ControlButton>
      <ControlButton label={media.isCameraOn ? "Turn camera off" : "Turn camera on"} onPress={media.toggleCamera} isOff={!media.isCameraOn}>
        {media.isCameraOn ? <VideoCamera24Icon size={20} color="#FFFFFF" /> : <VideoCameraSlash24Icon size={20} color="#FFFFFF" />}
      </ControlButton>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { position: "absolute", right: 12, alignItems: "center", gap: 10, zIndex: 4 },
  button: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(16,16,24,0.55)" },
  buttonOff: { backgroundColor: "rgba(255,77,79,0.85)" },
  quality: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(16,16,24,0.55)" },
  qualityDot: { width: 8, height: 8, borderRadius: 4 },
});
