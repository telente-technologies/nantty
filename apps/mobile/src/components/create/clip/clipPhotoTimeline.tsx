import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Minus16Icon, Plus16Icon } from "@/components/icons";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ClipTransition, ID } from "@/types";

import type { PostDraftMediaItem } from "../postDraftUploads.hook";
import { PHOTO_SECONDS_MAXIMUM, PHOTO_SECONDS_MINIMUM } from "./clipDraft.util";

const TRANSITIONS: readonly { value: ClipTransition; label: string }[] = [
  { value: "none", label: "No transition" },
  { value: "crossfade", label: "Fade" },
  { value: "slide", label: "Slide" },
];

export interface ClipPhotoTimelineProps {
  readonly items: readonly PostDraftMediaItem[];
  readonly selectedJobId: ID | null;
  readonly onSelect: (jobId: ID) => void;
  readonly secondsFor: (jobId: ID) => number;
  readonly onChangeSeconds: (jobId: ID, seconds: number) => void;
  readonly onMove: (jobId: ID, offset: -1 | 1) => void;
  readonly onRemove: (jobId: ID) => void;
  readonly transition: ClipTransition;
  readonly onChangeTransition: (transition: ClipTransition) => void;
}

export function ClipPhotoTimeline(props: ClipPhotoTimelineProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const selectedIndex = Math.max(0, props.items.findIndex((item) => item.jobId === props.selectedJobId));
  const selected = props.items[selectedIndex];
  const seconds = selected ? props.secondsFor(selected.jobId) : 0;
  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
        {props.items.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Pressable
              key={item.jobId}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Photo ${index + 1} of ${props.items.length}, ${props.secondsFor(item.jobId)} seconds`}
              onPress={() => props.onSelect(item.jobId)}
              style={[styles.thumb, isSelected ? styles.thumbSelected : null]}
            >
              <Image source={{ uri: item.previewUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={styles.badge}><Text size={11} weight={600} lineHeight={14} color={colors.white}>{props.secondsFor(item.jobId)}s</Text></View>
            </Pressable>
          );
        })}
      </ScrollView>
      {selected ? (
        <View style={styles.editor}>
          <View style={styles.row}>
            <Text size={13} weight={500} lineHeight={16.9} style={styles.flex}>Photo {selectedIndex + 1} shows for {seconds}s</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Show this photo one second less" disabled={seconds <= PHOTO_SECONDS_MINIMUM} onPress={() => props.onChangeSeconds(selected.jobId, seconds - 1)} style={[styles.round, seconds <= PHOTO_SECONDS_MINIMUM ? styles.dim : null]}>
              <Minus16Icon color={colors.text} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Show this photo one second more" disabled={seconds >= PHOTO_SECONDS_MAXIMUM} onPress={() => props.onChangeSeconds(selected.jobId, seconds + 1)} style={[styles.round, seconds >= PHOTO_SECONDS_MAXIMUM ? styles.dim : null]}>
              <Plus16Icon color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.row}>
            <Text size={13} weight={500} lineHeight={16.9} color={selectedIndex === 0 ? colors.disabledText : colors.link} accessibilityRole="button" accessibilityState={{ disabled: selectedIndex === 0 }} onPress={selectedIndex === 0 ? undefined : () => props.onMove(selected.jobId, -1)} style={styles.action}>Move earlier</Text>
            <Text size={13} weight={500} lineHeight={16.9} color={selectedIndex === props.items.length - 1 ? colors.disabledText : colors.link} accessibilityRole="button" accessibilityState={{ disabled: selectedIndex === props.items.length - 1 }} onPress={selectedIndex === props.items.length - 1 ? undefined : () => props.onMove(selected.jobId, 1)} style={styles.action}>Move later</Text>
            <Text size={13} weight={500} lineHeight={16.9} color={colors.error} accessibilityRole="button" onPress={() => props.onRemove(selected.jobId)} style={styles.action}>Remove</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Transition between photos">
        {TRANSITIONS.map((option) => (
          <Chip key={option.value} kind="filter" label={option.label} selected={props.transition === option.value} onPress={() => props.onChangeTransition(option.value)} />
        ))}
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 12 },
  flex: { flex: 1 },
  thumbs: { gap: 8 },
  thumb: { width: 56, height: 72, borderRadius: 8, overflow: "hidden", backgroundColor: colors.placeholder, borderWidth: 2, borderColor: "transparent" },
  thumbSelected: { borderColor: colors.primary },
  badge: { position: "absolute", right: 4, bottom: 4, paddingHorizontal: 4, borderRadius: 4, backgroundColor: colors.overlay },
  editor: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  round: { width: 44, height: 36, borderRadius: 18, backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.4 },
  action: { paddingVertical: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
}));
