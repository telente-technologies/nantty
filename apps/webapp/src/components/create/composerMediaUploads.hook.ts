"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { mediaUploadService, UploadOfflineError } from "@/services/mediaUpload.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import type { ID, MediaUploadPurpose } from "@/types";
import { MAXIMUM_MEDIA_PER_POST, MediaValidationError, validatePickedMediaBeforeUpload } from "@/utils/mediaUploadRules.util";

export type ComposerUploadStatus = "uploading" | "uploaded" | "failed";

export interface ComposerMediaItem {
  readonly localId: string;
  readonly file: File;
  readonly previewUrl: string;
  readonly mediaType: "image" | "video";
  readonly status: ComposerUploadStatus;
  readonly uploadedFraction: number;
  readonly mediaId: ID | null;
  readonly errorMessage: string | null;
  readonly durationSeconds: number | null;
}

function readVideoDurationSeconds(previewUrl: string): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => resolve(null);
    video.src = previewUrl;
  });
}

const describeUploadFailure = (error: unknown) =>
  error instanceof UploadOfflineError || error instanceof MediaValidationError ? error.message : readErrorMessageForDisplay(error);

export function useComposerMediaUploads(purpose: MediaUploadPurpose = "post") {
  const [items, setItemsState] = useState<readonly ComposerMediaItem[]>([]);
  const latestItems = useRef<readonly ComposerMediaItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const pendingUploads = useRef(new Map<string, Promise<void>>());

  const setItems = useCallback((change: (current: readonly ComposerMediaItem[]) => readonly ComposerMediaItem[]) => {
    latestItems.current = change(latestItems.current);
    setItemsState(latestItems.current);
  }, []);
  const updateItem = useCallback((localId: string, change: Partial<ComposerMediaItem>) => setItems((current) => current.map((item) => (item.localId === localId ? { ...item, ...change } : item))), [setItems]);

  const startUpload = useCallback((item: ComposerMediaItem) => {
    controllers.current.get(item.localId)?.abort();
    const controller = new AbortController();
    controllers.current.set(item.localId, controller);
    updateItem(item.localId, { status: "uploading", uploadedFraction: 0, errorMessage: null });
    const run = mediaUploadService
      .uploadFile(item.file, purpose, ({ uploadedBytes, totalBytes }) => updateItem(item.localId, { uploadedFraction: totalBytes > 0 ? uploadedBytes / totalBytes : 1 }), controller.signal)
      .then(({ mediaId }) => updateItem(item.localId, { status: "uploaded", uploadedFraction: 1, mediaId }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        updateItem(item.localId, { status: "failed", errorMessage: describeUploadFailure(error) });
      })
      .finally(() => {
        if (controllers.current.get(item.localId) === controller) controllers.current.delete(item.localId);
        pendingUploads.current.delete(item.localId);
      });
    pendingUploads.current.set(item.localId, run);
  }, [purpose, updateItem]);

  const addFiles = useCallback(async (files: readonly File[]): Promise<readonly string[]> => {
    const rejected: string[] = [];
    for (const file of files) {
      if (latestItems.current.length >= MAXIMUM_MEDIA_PER_POST) {
        rejected.push(`A post can have up to ${MAXIMUM_MEDIA_PER_POST} photos or videos.`);
        break;
      }
      const previewUrl = URL.createObjectURL(file);
      try {
        const isVideo = file.type.toLowerCase().startsWith("video/");
        const durationSeconds = isVideo ? await readVideoDurationSeconds(previewUrl) : null;
        const mediaType = validatePickedMediaBeforeUpload({ mimeType: file.type, sizeBytes: file.size, durationSeconds }, purpose);
        const item: ComposerMediaItem = { localId: crypto.randomUUID(), file, previewUrl, mediaType, status: "uploading", uploadedFraction: 0, mediaId: null, errorMessage: null, durationSeconds };
        setItems((current) => [...current, item]);
        startUpload(item);
      } catch (error) {
        URL.revokeObjectURL(previewUrl);
        rejected.push(error instanceof MediaValidationError ? error.message : "We couldn't add one of the files.");
      }
    }
    return [...new Set(rejected)];
  }, [purpose, setItems, startUpload]);

  const removeItem = useCallback((localId: string) => {
    controllers.current.get(localId)?.abort();
    const removed = latestItems.current.find((item) => item.localId === localId);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    setItems((current) => current.filter((item) => item.localId !== localId));
  }, [setItems]);

  const moveItem = useCallback((localId: string, offset: -1 | 1) => setItems((current) => {
    const next = [...current];
    const from = next.findIndex((item) => item.localId === localId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= next.length) return current;
    [next[from], next[to]] = [next[to]!, next[from]!];
    return next;
  }), [setItems]);

  const retryItem = useCallback((localId: string) => {
    const item = latestItems.current.find((candidate) => candidate.localId === localId);
    if (item && item.status === "failed") startUpload(item);
  }, [startUpload]);

  const clearAll = useCallback(() => {
    for (const item of latestItems.current) {
      controllers.current.get(item.localId)?.abort();
      URL.revokeObjectURL(item.previewUrl);
    }
    setItems(() => []);
  }, [setItems]);

  const waitForAllMediaIds = useCallback(async (): Promise<readonly ID[]> => {
    await Promise.all([...pendingUploads.current.values()]);
    const current = latestItems.current;
    if (current.some((item) => item.status === "failed")) throw new Error("A photo or video didn't upload. Retry it or remove it, then post again.");
    return current.map((item) => item.mediaId).filter((mediaId): mediaId is ID => mediaId !== null);
  }, []);

  useEffect(() => {
    const retryOfflineFailures = () => latestItems.current.filter((item) => item.status === "failed").forEach((item) => startUpload(item));
    window.addEventListener("online", retryOfflineFailures);
    return () => window.removeEventListener("online", retryOfflineFailures);
  }, [startUpload]);

  useEffect(() => {
    const activeControllers = controllers.current;
    return () => {
      activeControllers.forEach((controller) => controller.abort());
      latestItems.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  const combinedUploadedFraction = totalBytes === 0 ? 1 : items.reduce((sum, item) => sum + item.file.size * item.uploadedFraction, 0) / totalBytes;

  return {
    items,
    remainingSlots: MAXIMUM_MEDIA_PER_POST - items.length,
    combinedUploadedFraction,
    hasFailedUploads: items.some((item) => item.status === "failed"),
    addFiles,
    removeItem,
    moveItem,
    retryItem,
    clearAll,
    waitForAllMediaIds,
  };
}
