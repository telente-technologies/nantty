import { create } from "zustand";

import { ApiError } from "@/errors/api.error";
import { saveBrandedPostMediaToDevice } from "@/services/brandedMediaSaving.service";
import { showToast } from "@/store/toast.store";
import type { DownloadableMedia, Post } from "@/types";
import { DownloadCancelledError } from "@/utils/brandedDownloadPolling.util";

export interface ActiveMediaDownload {
  readonly postId: string;
  readonly mediaType: "image" | "video";
  readonly progress: number;
}

interface MediaDownloadState {
  readonly activeDownload: ActiveMediaDownload | null;
  readonly screenshotPromptPost: Post | null;
  readonly startBrandedDownload: (postId: string, media: DownloadableMedia) => void;
  readonly cancelBrandedDownload: () => void;
  readonly showScreenshotPrompt: (post: Post) => void;
  readonly dismissScreenshotPrompt: () => void;
}

let activeController: AbortController | null = null;

export const useMediaDownloadStore = create<MediaDownloadState>((set, get) => ({
  activeDownload: null,
  screenshotPromptPost: null,
  startBrandedDownload: (postId, media) => {
    if (get().activeDownload) {
      showToast("A download is already in progress.");
      return;
    }
    const controller = new AbortController();
    activeController = controller;
    set({ activeDownload: { postId, mediaType: media.type, progress: 0 } });
    const updateProgress = (progress: number) => {
      if (activeController !== controller) return;
      set((state) => (state.activeDownload ? { activeDownload: { ...state.activeDownload, progress: Math.max(state.activeDownload.progress, progress) } } : state));
    };
    saveBrandedPostMediaToDevice({ postId, media, onProgress: updateProgress, signal: controller.signal })
      .then((outcome) => showToast(outcome === "savedToLibrary" ? (media.type === "video" ? "Video saved to your gallery" : "Photo saved to your gallery") : "Ready to share", { tone: "success" }))
      .catch((error: unknown) => {
        if (error instanceof DownloadCancelledError || controller.signal.aborted) return;
        showToast(error instanceof ApiError ? error.message : "Couldn't download this. Try again.", { tone: "error" });
      })
      .finally(() => {
        if (activeController !== controller) return;
        activeController = null;
        set({ activeDownload: null });
      });
  },
  cancelBrandedDownload: () => {
    activeController?.abort();
    activeController = null;
    set({ activeDownload: null });
  },
  showScreenshotPrompt: (post) => set({ screenshotPromptPost: post }),
  dismissScreenshotPrompt: () => set({ screenshotPromptPost: null }),
}));
