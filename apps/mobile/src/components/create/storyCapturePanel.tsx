import type { CameraView } from "expo-camera";
import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Image24Icon, VideoCamera24Icon } from "@/components/icons";
import type { LocalMediaFile } from "@/services/mediaPreparation.service";
import type { CreateMode } from "@/types";

import { CameraBackdrop } from "./cameraBackdrop";
import { CreateModePill } from "./createModePill";
import { pickPhotosAndVideosFromLibrary, takePhotoWithSystemCamera } from "./pickMedia.util";
import { RecordButton } from "./recordButton";

export interface StoryCapturePanelProps {
  readonly publishing: boolean;
  readonly onChangeMode: (mode: CreateMode) => void;
  readonly onCaptured: (media: LocalMediaFile) => void;
}

export function StoryCapturePanel({ publishing, onChangeMode, onCaptured }: StoryCapturePanelProps) {
  const cameraRef = useRef<CameraView>(null);

  const captureStoryPhoto = async () => {
    const picture = await cameraRef.current?.takePictureAsync({ quality: 0.85 }).catch(() => undefined);
    if (!picture?.uri) return;
    onCaptured({
      uri: picture.uri,
      mediaType: "image",
      mimeType: "image/jpeg",
      fileName: null,
      sizeBytes: null,
      width: picture.width,
      height: picture.height,
      durationSeconds: null,
    });
  };
  const pickStoryFromLibrary = async () => {
    const [media] = await pickPhotosAndVideosFromLibrary(1);
    if (media) onCaptured(media);
  };
  const recordStoryVideo = async () => {
    const [media] = await takePhotoWithSystemCamera();
    if (media) onCaptured(media);
  };

  return (
    <View style={styles.flex}>
      <CameraBackdrop ref={cameraRef} active />
      <View style={styles.bottom} pointerEvents="box-none">
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 20, gap: 19, alignItems: "center" },
  controls: { flexDirection: "row", alignItems: "center", gap: 24 },
});
