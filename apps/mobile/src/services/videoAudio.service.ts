import { setAudioModeAsync } from "expo-audio";

export function claimAudioFocusForVideoPlayback(): void {
  setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
}

export function releaseAudioFocusForVideoPlayback(): void {
  setAudioModeAsync({ playsInSilentMode: false, allowsRecording: false }).catch(() => undefined);
}
