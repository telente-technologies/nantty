import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

import type { LocalMediaFile } from "@/services/media/mediaPreparation.service";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

const MINIMUM_VOICE_NOTE_SECONDS = 1;
const MAXIMUM_VOICE_NOTE_SECONDS = 300;

const stopRecorderIgnoringErrors = async (recorder: ReturnType<typeof useAudioRecorder>) => {
  try {
    if (recorder.isRecording) await recorder.stop();
  } catch {
    return;
  }
};

export function useVoiceNoteRecorder(onRecordingFinished: (voiceNote: LocalMediaFile) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [isPreparing, setIsPreparing] = useState(false);
  const recordingStartedAtRef = useRef<number | null>(null);

  const startRecordingVoiceNote = useCallback(async () => {
    setIsPreparing(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showAlertWithButtons("Microphone needed", "Allow microphone access in Settings to send voice notes.", undefined, { intent: "microphone" });
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAXIMUM_VOICE_NOTE_SECONDS });
      recordingStartedAtRef.current = Date.now();
    } catch {
      showAlertWithButtons("Couldn't start recording", "Please try again.", undefined, { intent: "microphone" });
    } finally {
      setIsPreparing(false);
    }
  }, [recorder]);

  const stopRecordingAndDiscard = useCallback(async () => {
    await stopRecorderIgnoringErrors(recorder);
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
  }, [recorder]);

  const stopRecordingAndSend = useCallback(async () => {
    const wallClockSeconds = recordingStartedAtRef.current ? (Date.now() - recordingStartedAtRef.current) / 1000 : 0;
    const durationSeconds = Math.min(wallClockSeconds || recorderState.durationMillis / 1000, MAXIMUM_VOICE_NOTE_SECONDS);
    recordingStartedAtRef.current = null;
    await stopRecorderIgnoringErrors(recorder);
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
