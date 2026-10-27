"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { showToast } from "@/components/ui/toast";
import { mediaDownloadsService } from "@/services/mediaDownloads.service";
import type { DownloadTarget } from "@/types";
import { pollUntilBrandedDownloadIsReady } from "@/utils/brandedDownload.util";

export interface BrandedDownloadProgress {
  readonly mediaType: DownloadTarget["mediaType"];
  readonly progress: number;
}

async function saveOrShareReadyFile(url: string, fileName: string | undefined, mediaType: DownloadTarget["mediaType"]): Promise<"savedToLibrary" | "sharedInstead"> {
  const resolvedName = fileName ?? `nantty-download.${mediaType === "video" ? "mp4" : "jpg"}`;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], resolvedName, { type: blob.type || (mediaType === "video" ? "video/mp4" : "image/jpeg") });
    const navigatorWithShare = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files: File[]; title?: string }) => Promise<void> };
    if (navigatorWithShare.canShare?.({ files: [file] }) && navigatorWithShare.share) {
      await navigatorWithShare.share({ files: [file], title: resolvedName });
      return "sharedInstead";
    }
  } catch {
    throw new Error("share-failed");
  }
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  anchor.download = resolvedName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return "savedToLibrary";
}

export function useBrandedMediaDownload() {
  const [activeDownload, setActiveDownload] = useState<BrandedDownloadProgress | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const cancelDownload = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setActiveDownload(null);
  }, []);

  const startDownload = useCallback(async (target: DownloadTarget) => {
    if (controllerRef.current) {
      showToast({ text: "A download is already in progress." });
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setActiveDownload({ mediaType: target.mediaType, progress: 0 });
    try {
      const ready = await pollUntilBrandedDownloadIsReady({
        requestDownload: () => mediaDownloadsService.requestPostMediaDownload(target.postId, target.mediaId, controller.signal),
        onProgress: (progress) => setActiveDownload((current) => (current ? { ...current, progress: Math.max(current.progress, progress) } : current)),
        signal: controller.signal,
      });
      setActiveDownload({ mediaType: target.mediaType, progress: 1 });
      let outcome: "savedToLibrary" | "sharedInstead";
      try {
        outcome = await saveOrShareReadyFile(ready.url, ready.fileName, target.mediaType);
      } catch {
        const anchor = document.createElement("a");
        anchor.href = ready.url;
        anchor.rel = "noopener";
        if (ready.fileName) anchor.download = ready.fileName;
        anchor.target = "_blank";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        outcome = "savedToLibrary";
      }
      if (outcome === "savedToLibrary") showToast({ text: target.mediaType === "video" ? "Video saved to your gallery" : "Photo saved to your gallery" });
      else showToast({ text: "Ready to share" });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error && error.message === "share-failed" ? "Couldn't download this. Try again." : "Couldn't download this. Try again.";
      showToast({ text: message, tone: "error" });
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setActiveDownload(null);
      }
    }
  }, []);

  return { activeDownload, startDownload, cancelDownload };
}
