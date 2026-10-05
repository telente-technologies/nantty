"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { mediaDownloadsService } from "@/services/mediaDownloads.service";
import type { DownloadTarget } from "@/types";
import { pollUntilBrandedDownloadIsReady } from "@/utils/brandedDownload.util";

export interface BrandedDownloadProgress {
  readonly mediaType: DownloadTarget["mediaType"];
  readonly progress: number;
}

function startBrowserDownload(url: string, fileName: string | undefined): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  if (fileName) anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
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
    if (controllerRef.current) return;
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
      startBrowserDownload(ready.url, ready.fileName);
      showToast({ text: target.mediaType === "video" ? "Your video is downloading" : "Your photo is downloading" });
    } catch (error) {
      if (!controller.signal.aborted) showToast({ text: readErrorMessageForDisplay(error), tone: "error" });
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setActiveDownload(null);
      }
    }
  }, []);

  return { activeDownload, startDownload, cancelDownload };
}
