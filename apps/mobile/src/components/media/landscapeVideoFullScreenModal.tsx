import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect, useState } from "react";
import { Platform, Pressable, StatusBar, StyleSheet, View, useWindowDimensions } from "react-native";

import { ArrowsOutSimple24Icon, Cancel20Icon } from "@/components/icons";
import { FrameAwareModal } from "@/components/ui/frameAwareModal";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { Media } from "@/types";

import { ClipVideoPlayer } from "./clipVideoPlayer";
import { isLandscapeMedia } from "./videoOrientation.util";

export interface LandscapeVideoFullScreenModalProps {
  readonly media: Media | null;
  readonly isMuted: boolean;
  readonly onClose: () => void;
}

const canLockScreenOrientation = Platform.OS === "ios" || Platform.OS === "android";

export function LandscapeVideoFullScreenModal({ media, isMuted, onClose }: LandscapeVideoFullScreenModalProps) {
  const isOpen = media !== null;
  const { width, height } = useWindowDimensions();
  const [isRotated, setIsRotated] = useState(false);
  const isLandscapeClip = isLandscapeMedia(media ?? undefined);
  const showRotateButton = isLandscapeClip && !isRotated;
  const isWebRotated = isRotated && !canLockScreenOrientation;

  useEffect(() => {
    if (!isOpen) {
      setIsRotated(false);
      return;
    }
    if (isLandscapeClip && canLockScreenOrientation) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
        .then(() => setIsRotated(true))
        .catch(() => undefined);
    }
    return () => {
      if (canLockScreenOrientation) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
      }
      setIsRotated(false);
    };
  }, [isOpen, isLandscapeClip]);

  const rotateToFillScreen = () => {
    if (canLockScreenOrientation) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
        .then(() => setIsRotated(true))
        .catch(() => undefined);
      return;
    }
    setIsRotated(true);
  };

  const stageStyle = isWebRotated ? [styles.stage, styles.rotatedStage, { width: height, height: width }] : styles.stage;

  return (
    <FrameAwareModal visible={isOpen} animationType="fade" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <StatusBar hidden />
      <View style={styles.root}>
        <View style={stageStyle}>
          {media ? <ClipVideoPlayer media={media} isActive isMuted={isMuted} contentFit="contain" style={StyleSheet.absoluteFill} /> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Exit full screen" hitSlop={12} onPress={onClose} style={styles.close}>
          <Cancel20Icon color={colors.white} />
        </Pressable>
        {showRotateButton ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rotate video to fill the screen"
            hitSlop={8}
            onPress={rotateToFillScreen}
            style={styles.rotate}
          >
            <ArrowsOutSimple24Icon color={colors.white} size={18} />
            <Text size={13} lineHeight={16} weight={500} color={colors.white}>
              Rotate
            </Text>
          </Pressable>
        ) : null}
      </View>
    </FrameAwareModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" },
  stage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  rotatedStage: { transform: [{ rotate: "90deg" }] },
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
  rotate: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: colors.overlay,
  },
});
