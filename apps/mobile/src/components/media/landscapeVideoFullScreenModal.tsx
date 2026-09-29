import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect } from "react";
import { Platform, Pressable, StatusBar, StyleSheet, View } from "react-native";

import { Cancel20Icon } from "@/components/icons";
import { colors } from "@/constants/colors.constant";
import type { Media } from "@/types";

import { ClipVideoPlayer } from "./clipVideoPlayer";
import { FrameAwareModal } from "@/components/ui/frameAwareModal";

export interface LandscapeVideoFullScreenModalProps {
  readonly media: Media | null;
  readonly isMuted: boolean;
  readonly onClose: () => void;
}

const canLockScreenOrientation = Platform.OS === "ios" || Platform.OS === "android";

export function LandscapeVideoFullScreenModal({ media, isMuted, onClose }: LandscapeVideoFullScreenModalProps) {
  const isOpen = media !== null;

  useEffect(() => {
    if (!isOpen || !canLockScreenOrientation) return;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, [isOpen]);

  return (
    <FrameAwareModal visible={isOpen} animationType="fade" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <StatusBar hidden />
      <View style={styles.root}>
        {media ? <ClipVideoPlayer media={media} isActive isMuted={isMuted} contentFit="contain" style={StyleSheet.absoluteFill} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Exit full screen" hitSlop={12} onPress={onClose} style={styles.close}>
          <Cancel20Icon color={colors.white} />
        </Pressable>
      </View>
    </FrameAwareModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  close: {
    position: "absolute",
    top: 24,
    left: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
});
