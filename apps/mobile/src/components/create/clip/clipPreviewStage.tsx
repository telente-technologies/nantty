import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowsOutSimple24Icon, Cancel20Icon, PauseFill24Icon, Play24Icon } from "@/components/icons";
import { ClipVideoPlayer } from "@/components/media/clipVideoPlayer";
import { Text } from "@/components/ui/text";
import { colors as brandColors } from "@/constants/colors.constant";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ClipTransition, ID } from "@/types";

import { convertDraftItemsToPreviewMedia, type PostDraftMediaItem } from "../postDraftUploads.hook";
import { CLIP_MAXIMUM_SECONDS, formatClipSeconds, type ClipTrim } from "./clipDraft.util";
import { ClipPhotoTimeline } from "./clipPhotoTimeline";
import { ClipSlideshowPreview } from "./clipSlideshowPreview";
import { ClipTrimControls } from "./clipTrimControls";

export interface ClipPreviewStageProps {
  readonly items: readonly PostDraftMediaItem[];
  readonly source: "video" | "photos";
  readonly totalSeconds: number;
  readonly validationMessage: string | null;
  readonly trim: ClipTrim | null;
  readonly onChangeTrim: (trim: ClipTrim) => void;
  readonly transition: ClipTransition;
  readonly onChangeTransition: (transition: ClipTransition) => void;
  readonly secondsFor: (jobId: ID) => number;
  readonly onChangeSeconds: (jobId: ID, seconds: number) => void;
  readonly onMove: (jobId: ID, offset: -1 | 1) => void;
  readonly onRemove: (jobId: ID) => void;
}

function ClipPlayer({ items, source, transition, secondsFor, isPlaying }: Pick<ClipPreviewStageProps, "items" | "source" | "transition" | "secondsFor"> & { isPlaying: boolean }) {
  if (source === "video") {
    const media = convertDraftItemsToPreviewMedia(items)[0];
    return media ? <ClipVideoPlayer media={media} isActive isMuted={false} isPausedByUser={!isPlaying} contentFit="contain" style={StyleSheet.absoluteFill} /> : null;
  }
  return <ClipSlideshowPreview uris={items.map((item) => item.previewUri)} secondsPerImage={items.map((item) => secondsFor(item.jobId))} transition={transition} isPlaying={isPlaying} />;
}

export function ClipPreviewStage(props: ClipPreviewStageProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<ID | null>(null);
  const isTooLong = props.totalSeconds > CLIP_MAXIMUM_SECONDS;
  const playToggle = (
    <Pressable accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause preview" : "Play preview"} onPress={() => setIsPlaying((value) => !value)} style={styles.overlayButton}>
      {isPlaying ? <PauseFill24Icon size={20} color={brandColors.white} /> : <Play24Icon size={20} color={brandColors.white} />}
    </Pressable>
  );
  return (
    <View style={styles.root}>
      <View style={styles.canvas}>
        {isFullScreen ? null : <ClipPlayer {...props} isPlaying={isPlaying} />}
        <View style={styles.overlayRow}>
          {playToggle}
          <Pressable accessibilityRole="button" accessibilityLabel="Preview full screen" onPress={() => setIsFullScreen(true)} style={styles.overlayButton}>
            <ArrowsOutSimple24Icon size={20} color={brandColors.white} />
          </Pressable>
        </View>
      </View>
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <Text size={13} weight={600} lineHeight={16.9} color={isTooLong ? colors.error : colors.textMuted} accessibilityLiveRegion="polite">
          Length {formatClipSeconds(props.totalSeconds)} of {formatClipSeconds(CLIP_MAXIMUM_SECONDS)}
        </Text>
        {props.source === "video" ? (
          <ClipTrimControls durationSeconds={props.items[0]?.durationSeconds ?? null} trim={props.trim} onChange={props.onChangeTrim} />
        ) : (
          <ClipPhotoTimeline
            items={props.items}
            selectedJobId={selectedJobId}
            onSelect={setSelectedJobId}
            secondsFor={props.secondsFor}
            onChangeSeconds={props.onChangeSeconds}
            onMove={props.onMove}
            onRemove={props.onRemove}
            transition={props.transition}
            onChangeTransition={props.onChangeTransition}
          />
        )}
        {props.validationMessage ? <Text size={12} lineHeight={16.8} color={colors.error}>{props.validationMessage}</Text> : null}
      </ScrollView>
      <Modal visible={isFullScreen} animationType="fade" presentationStyle="fullScreen" supportedOrientations={["portrait"]} onRequestClose={() => setIsFullScreen(false)}>
        <View style={[styles.fullScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <ClipPlayer {...props} isPlaying={isPlaying} />
          <View style={[styles.fullScreenTop, { top: insets.top + 8 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close full screen preview" hitSlop={8} onPress={() => setIsFullScreen(false)} style={styles.overlayButton}>
              <Cancel20Icon size={18} color={brandColors.white} />
            </Pressable>
            {playToggle}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1 },
  canvas: { flex: 1, minHeight: 280, backgroundColor: colors.media, overflow: "hidden" },
  overlayRow: { position: "absolute", left: 12, right: 12, bottom: 12, flexDirection: "row", justifyContent: "space-between" },
  overlayButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  panel: { flexGrow: 0, maxHeight: "45%" },
  panelContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 12 },
  fullScreen: { flex: 1, backgroundColor: "#000000" },
  fullScreenTop: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
}));
