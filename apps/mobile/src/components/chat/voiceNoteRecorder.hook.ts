import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";

import type { LocalMediaFile } from "@/services/mediaPreparation.service";

const MINIMUM_VOICE_NOTE_SECONDS = 1;
const MAXIMUM_VOICE_NOTE_SECONDS = 300;

export function useVoiceNoteRecorder(onRecordingFinished: (voiceNote: LocalMediaFile) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [isPreparing, setIsPreparing] = useState(false);

  const startRecordingVoiceNote = useCallback(async () => {
    setIsPreparing(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microphone needed", "Allow microphone access in Settings to send voice notes.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAXIMUM_VOICE_NOTE_SECONDS });
    } catch {
      Alert.alert("Couldn't start recording", "Please try again.");
    } finally {
      setIsPreparing(false);
    }
  }, [recorder]);

  const stopRecordingAndDiscard = useCallback(async () => {
    await recorder.stop().catch(() => undefined);
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
  }, [recorder]);

  const stopRecordingAndSend = useCallback(async () => {
    const durationSeconds = recorderState.durationMillis / 1000;
    await recorder.stop().catch(() => undefined);
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    const recordedUri = recorder.uri;
    if (!recordedUri || durationSeconds < MINIMUM_VOICE_NOTE_SECONDS) return;
    const isWebRecording = Platform.OS === "web";
    onRecordingFinished({
      uri: recordedUri,
      mediaType: "audio",
      mimeType: isWebRecording ? "audio/webm" : "audio/mp4",
      fileName: `voice-note-${Date.now()}.${isWebRecording ? "webm" : "m4a"}`,
      sizeBytes: null,
      width: null,
      height: null,
      durationSeconds,
    });
  }, [onRecordingFinished, recorder, recorderState.durationMillis]);

  return {
    isRecording: recorderState.isRecording,
    isPreparing,
    recordedSeconds: Math.floor(recorderState.durationMillis / 1000),
    startRecordingVoiceNote,
    stopRecordingAndDiscard,
    stopRecordingAndSend,
  };
}

export const formatVoiceNoteDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
