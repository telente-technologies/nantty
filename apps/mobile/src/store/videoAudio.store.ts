import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { claimAudioFocusForVideoPlayback, releaseAudioFocusForVideoPlayback } from "@/services/clips/videoAudio.service";

interface VideoAudioState {
  readonly isMuted: boolean;
  readonly toggleMute: () => void;
  readonly setMuted: (isMuted: boolean) => void;
}

export const useVideoAudioStore = create<VideoAudioState>()(
  persist(
    (set, get) => ({
      isMuted: Platform.OS === "web",
      toggleMute: () => get().setMuted(!get().isMuted),
      setMuted: (isMuted) => {
        set({ isMuted });
        if (isMuted) releaseAudioFocusForVideoPlayback();
        else claimAudioFocusForVideoPlayback();
      },
    }),
    {
      name: "zm.videoAudioPreference",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ isMuted: state.isMuted }),
    },
  ),
);

export const readVideoAudioPreference = () => useVideoAudioStore.getState().isMuted;
