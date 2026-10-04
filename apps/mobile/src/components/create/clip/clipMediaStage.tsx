import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { ImageSquare24Icon, Play24Icon, VideoCamera24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import type { LocalMediaFile } from "@/services/mediaPreparation.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { CreateMode } from "@/types";

import { CreateModePill } from "../createModePill";
import { pickOneVideoFromLibrary, pickPhotosFromLibrary, recordClipVideoWithSystemCamera } from "../pickMedia.util";
import { CLIP_MAXIMUM_PHOTOS } from "./clipDraft.util";

interface ClipSourceOption {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly icon: ReactNode;
  readonly pick: () => Promise<LocalMediaFile[]>;
}

export interface ClipMediaStageProps {
  readonly mode: CreateMode;
  readonly onChangeMode: (mode: CreateMode) => void;
  readonly onPicked: (files: readonly LocalMediaFile[]) => Promise<void>;
}

export function ClipMediaStage({ mode, onChangeMode, onPicked }: ClipMediaStageProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const options: readonly ClipSourceOption[] = [
    { key: "record", title: "Record a video", detail: "Use your camera. Up to 3 minutes.", icon: <VideoCamera24Icon color={colors.primary} />, pick: recordClipVideoWithSystemCamera },
    { key: "video", title: "Choose a video", detail: "From your library. Up to 3 minutes.", icon: <Play24Icon color={colors.primary} />, pick: pickOneVideoFromLibrary },
    { key: "photos", title: "Make a photo clip", detail: `Pick up to ${CLIP_MAXIMUM_PHOTOS} photos to play as a slideshow.`, icon: <ImageSquare24Icon color={colors.primary} />, pick: () => pickPhotosFromLibrary(CLIP_MAXIMUM_PHOTOS) },
  ];
  const run = async (option: ClipSourceOption) => {
    if (busyKey) return;
    setBusyKey(option.key);
    try {
      const files = await option.pick();
      if (files.length > 0) await onPicked(files);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.options}>
        <Text size={15} lineHeight={21} color={colors.textMuted}>Start with a video or a few photos. You can preview, trim and add a sound next.</Text>
        {options.map((option) => (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityLabel={option.title}
            accessibilityHint={option.detail}
            accessibilityState={{ busy: busyKey === option.key, disabled: !!busyKey }}
            onPress={() => void run(option)}
            style={({ pressed }) => [styles.option, pressed ? styles.pressed : null]}
          >
            <View style={styles.icon}>{busyKey === option.key ? <ActivityIndicator color={colors.primary} /> : option.icon}</View>
            <View style={styles.texts}>
              <Text size={16} weight={600} lineHeight={20}>{option.title}</Text>
              <Text size={13} lineHeight={18} color={colors.textMuted}>{option.detail}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={styles.pill}>
        <CreateModePill mode={mode} onChangeMode={onChangeMode} />
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, justifyContent: "space-between" },
  options: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  option: { minHeight: 76, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 14 },
  pressed: { backgroundColor: colors.background },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  texts: { flex: 1, gap: 2 },
  pill: { paddingBottom: 29 },
}));
