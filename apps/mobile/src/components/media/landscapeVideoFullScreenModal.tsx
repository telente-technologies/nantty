import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Platform, Pressable, StatusBar, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowsOutSimple24Icon } from "@/components/icons";
import { FrameAwareModal } from "@/components/ui/frameAwareModal";
import { mediaGlass } from "@/components/ui/modalChrome.constant";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { SaveToggleButton } from "@/components/saves/saveToggleButton";
import { MediaLightboxPostActions, type MediaLightboxPostActionsProps } from "@/components/feed/mediaLightboxPostActions";
import type { Media, SaveTarget } from "@/types";

import { ClipVideoPlayer, type VideoPlaybackController, type VideoPlaybackProgress } from "./clipVideoPlayer";
import { FullScreenVideoControls } from "./fullScreenVideoControls";
import { isLandscapeMedia } from "./videoOrientation.util";
import { ClipLookOverlay, isClipLookId } from "@/components/create/clip/clipLook.constant";

export interface LandscapeVideoFullScreenModalProps {
  readonly media: Media | null;
  readonly isMuted: boolean;
  readonly onClose: (positionSeconds?: number) => void;
  readonly onToggleMute?: () => void;
  readonly canSeek?: boolean;
  readonly startAtSeconds?: number;
  readonly saveTarget?: SaveTarget;
  readonly savedAccordingToServer?: boolean;
  readonly postActions?: MediaLightboxPostActionsProps;
  readonly look?: string | null;
}

const canLockScreenOrientation = Platform.OS === "ios" || Platform.OS === "android";
const CONTROLS_AUTO_HIDE_MS = 3000;
const POST_ACTIONS_ROW_HEIGHT = 52;
const POST_ACTIONS_BOTTOM_GAP = 12;
const PLAYBACK_CONTROLS_GAP = 8;

export function LandscapeVideoFullScreenModal(props: LandscapeVideoFullScreenModalProps) {
  const { media } = props;
  const isOpen = media !== null;
  const { width, height } = useWindowDimensions();
  const [isRotated, setIsRotated] = useState(false);
  const isLandscapeClip = isLandscapeMedia(media ?? undefined);
  const isWebRotated = isRotated && !canLockScreenOrientation;
  const controllerRef = useRef<VideoPlaybackController | null>(null);
  const close = () => props.onClose(controllerRef.current?.positionSeconds());

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

  return (
    <FrameAwareModal visible={isOpen} animationType="fade" onRequestClose={close} supportedOrientations={["portrait", "landscape"]}>
      <StatusBar hidden />
      {media ? (
        <FullScreenVideoStage
          key={media.id ?? media.url ?? "video"}
          {...props}
          media={media}
          controllerRef={controllerRef}
          rotatedSize={isWebRotated ? { width: height, height: width } : null}
          onRotate={isLandscapeClip && !isRotated ? rotateToFillScreen : undefined}
          onExit={close}
        />
      ) : null}
    </FrameAwareModal>
  );
}

interface FullScreenVideoStageProps extends LandscapeVideoFullScreenModalProps {
  readonly media: Media;
  readonly controllerRef: RefObject<VideoPlaybackController | null>;
  readonly rotatedSize: { width: number; height: number } | null;
  readonly onRotate?: () => void;
  readonly onExit: () => void;
}

function FullScreenVideoStage({ media, controllerRef, rotatedSize, onRotate, onExit, canSeek = true, startAtSeconds, ...props }: FullScreenVideoStageProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const safeAreaInsets = useSafeAreaInsets();
  const [progress, setProgress] = useState<VideoPlaybackProgress>({ currentSeconds: startAtSeconds ?? 0, durationSeconds: media.durationSeconds ?? 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const [lastInteractionAt, setLastInteractionAt] = useState(0);
  const [mutedHere, setMutedHere] = useState<boolean | null>(null);
  const isMuted = mutedHere ?? props.isMuted;
  const actionBarBottomPadding = Math.max(safeAreaInsets.bottom, 16) + POST_ACTIONS_BOTTOM_GAP;
  const playbackControlsBottomOffset = props.postActions
    ? actionBarBottomPadding + POST_ACTIONS_ROW_HEIGHT + PLAYBACK_CONTROLS_GAP - Math.max(safeAreaInsets.bottom, 8)
    : 0;

  useEffect(() => {
    if (!areControlsVisible || isPaused || isScrubbing) return;
    const timer = setTimeout(() => setAreControlsVisible(false), CONTROLS_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [areControlsVisible, isPaused, isScrubbing, lastInteractionAt]);

  const keepControlsAwake = () => setLastInteractionAt(Date.now());
  const seekBy = (deltaSeconds: number) => {
    keepControlsAwake();
    controllerRef.current?.seekBy(deltaSeconds);
  };

  const stageStyle = rotatedSize ? [styles.stage, styles.rotatedStage, rotatedSize] : styles.stage;

  return (
    <View style={styles.root}>
      <View style={stageStyle}>
        <ClipVideoPlayer
          media={media}
          isActive
          isMuted={isMuted}
          isPausedByUser={isPaused || isScrubbing}
          contentFit="contain"
          startAtSeconds={startAtSeconds}
          controllerRef={controllerRef}
          onPlaybackProgress={setProgress}
          style={StyleSheet.absoluteFill}
        />
        <ClipLookOverlay look={isClipLookId(props.look) ? props.look : "none"} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={areControlsVisible ? "Hide video controls" : "Show video controls"}
          onPress={() => setAreControlsVisible((visible) => !visible)}
          style={StyleSheet.absoluteFill}
        />
        {areControlsVisible ? (
          <FullScreenVideoControls
            progress={progress}
            isPaused={isPaused}
            isMuted={isMuted}
            canSeek={canSeek}
            onTogglePlay={() => {
              keepControlsAwake();
              setIsPaused((paused) => !paused);
            }}
            onSeekBy={seekBy}
            onScrubStart={() => setIsScrubbing(true)}
            onScrubEnd={(targetSeconds) => {
              setIsScrubbing(false);
              keepControlsAwake();
              if (targetSeconds !== null) controllerRef.current?.seekTo(targetSeconds);
            }}
            onToggleMute={() => {
              keepControlsAwake();
              setMutedHere(!isMuted);
              props.onToggleMute?.();
            }}
            bottomOffset={playbackControlsBottomOffset}
            onExit={onExit}
            topCenter={
              onRotate ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Rotate video to fill the screen" hitSlop={8} onPress={onRotate} style={styles.rotate}>
                  <ArrowsOutSimple24Icon color={colors.white} size={16} />
                  <Text size={13} lineHeight={16} weight={500} color={colors.white}>
                    Rotate
                  </Text>
                </Pressable>
              ) : null
            }
            topRight={
              props.saveTarget ? (
                <View style={styles.saveCircle}>
                  <SaveToggleButton target={props.saveTarget} savedAccordingToServer={props.savedAccordingToServer ?? false} foregroundColor={colors.white} />
                </View>
              ) : null
            }
          />
        ) : null}
      </View>
      {props.postActions ? (
        <View
          pointerEvents="box-none"
          style={[styles.postActions, { paddingBottom: actionBarBottomPadding }]}
          testID="fullscreen-video-post-actions"
        >
          <MediaLightboxPostActions {...props.postActions} />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" },
  stage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  rotatedStage: { transform: [{ rotate: "90deg" }] },
  postActions: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 2, elevation: 2 },
  saveCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: mediaGlass.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mediaGlass.border,
    alignItems: "center",
    justifyContent: "center",
  },
  rotate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: mediaGlass.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mediaGlass.border,
  },
}));
