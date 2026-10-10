import type { CameraView } from "expo-camera";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Image24Icon, VideoCamera24Icon } from "@/components/icons";
import type { LocalMediaFile } from "@/services/media/mediaPreparation.service";
import type { CreateMode, ID } from "@/types";

import { CameraBackdrop } from "./cameraBackdrop";
import { CLIP_LOOK_LABELS, CLIP_LOOKS, ClipLookOverlay, type ClipLookId } from "./clip/clipLook.constant";
import { CreateModePill } from "./createModePill";
import { pickPhotosAndVideosFromLibrary, takePhotoWithSystemCamera } from "./pickMedia.util";
import { RecordButton } from "./recordButton";
import { SoundPickerRow } from "./soundPickerRow";
import { Text } from "@/components/ui/text";
import { makeThemedStyles } from "@/theme";

export interface StoryCapturePanelProps {
  readonly publishing: boolean;
  readonly onChangeMode: (mode: CreateMode) => void;
  readonly onCaptured: (captured: { file: LocalMediaFile; soundId: ID | null; look: ClipLookId }) => void;
}

export function StoryCapturePanel({ publishing, onChangeMode, onCaptured }: StoryCapturePanelProps) {
  const styles = useStyles();
  const cameraRef = useRef<CameraView>(null);
  const [soundId, setSoundId] = useState<ID | null>(null);
  const [look, setLook] = useState<ClipLookId>("none");

  const captureStoryPhoto = async () => {
    const picture = await cameraRef.current?.takePictureAsync({ quality: 0.85 }).catch(() => undefined);
    if (!picture?.uri) return;
      onCaptured({
      file: {
        uri: picture.uri,
        mediaType: "image",
        mimeType: "image/jpeg",
        fileName: null,
        sizeBytes: null,
        width: picture.width,
        height: picture.height,
        durationSeconds: null,
      },
      soundId,
      look,
    });
  };
  const pickStoryFromLibrary = async () => {
    const [media] = await pickPhotosAndVideosFromLibrary(1);
    if (media) onCaptured({ file: media, soundId, look });
  };
  const recordStoryVideo = async () => {
    const [media] = await takePhotoWithSystemCamera();
    if (media) onCaptured({ file: media, soundId, look });
  };

  return (
    <View style={styles.flex}>
      <CameraBackdrop ref={cameraRef} active />
      <ClipLookOverlay look={look} />
      <View style={styles.bottom} pointerEvents="box-none">
        <View style={styles.soundRow} pointerEvents="auto">
          <SoundPickerRow selectedSoundId={soundId} onChangeSelectedSoundId={setSoundId} hasOwnAudio />
        </View>
        <View style={styles.lookRow} pointerEvents="auto" accessibilityRole="radiogroup" accessibilityLabel="Choose a color look">
          {CLIP_LOOKS.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: option === look }}
              accessibilityLabel={`${CLIP_LOOK_LABELS[option]} look`}
              hitSlop={6}
              onPress={() => setLook(option)}
              style={[styles.swatch, look === option ? styles.swatchSelected : null]}
            >
              <Text size={11} weight={look === option ? 700 : 500} lineHeight={14} color="#FFFFFF">
                {CLIP_LOOK_LABELS[option]}
              </Text>
            </Pressable>
          ))}
        </View>
        <CreateModePill mode="story" onChangeMode={onChangeMode} />
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose from library" hitSlop={10} onPress={pickStoryFromLibrary}>
            <Image24Icon />
          </Pressable>
          <RecordButton label="Take story photo" disabled={publishing} onPress={captureStoryPhoto} />
          <Pressable accessibilityRole="button" accessibilityLabel="Record a video" hitSlop={10} onPress={recordStoryVideo}>
            <VideoCamera24Icon />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 20, gap: 19, alignItems: "center" },
  soundRow: { width: "92%", backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 4 },
  lookRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16 },
  swatch: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "transparent" },
  swatchSelected: { borderColor: "#FFFFFF" },
  controls: { flexDirection: "row", alignItems: "center", gap: 24 },
}));
