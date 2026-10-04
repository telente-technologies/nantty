import { useCallback, useRef, useState } from "react";

import type { LocalMediaFile } from "@/services/mediaPreparation.service";
import { MediaValidationError } from "@/services/mediaPreparation.service";
import { cancelAndRemoveUpload, enqueueLocalMediaForUpload, waitForReservedMediaId } from "@/services/mediaUploadQueue.service";
import { useCombinedUploadProgress } from "@/store/uploadQueue.store";
import type { ID, Media, MediaUploadPurpose, Post } from "@/types";

import { MAXIMUM_MEDIA_PER_POST } from "./pickMedia.util";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

export interface PostDraftMediaItem {
  readonly jobId: ID;
  readonly previewUri: string;
  readonly mediaType: "image" | "video";
  readonly width: number | null;
  readonly height: number | null;
  readonly durationSeconds: number | null;
}

export function usePostDraftMediaUploads(purpose: MediaUploadPurpose = "post") {
  const [draftMediaItems, setDraftMediaItemsState] = useState<readonly PostDraftMediaItem[]>([]);
  const latestDraftMediaItems = useRef<readonly PostDraftMediaItem[]>([]);
  const setDraftMediaItems = useCallback((items: readonly PostDraftMediaItem[]) => {
    latestDraftMediaItems.current = items;
    setDraftMediaItemsState(items);
  }, []);
  const combinedUploadedFraction = useCombinedUploadProgress(draftMediaItems.map((item) => item.jobId));

  const addPickedMediaAndStartUploading = useCallback(
    async (pickedFiles: readonly LocalMediaFile[]) => {
      const rejectedMessages: string[] = [];
      for (const pickedFile of pickedFiles) {
        if (latestDraftMediaItems.current.length >= MAXIMUM_MEDIA_PER_POST) break;
        try {
          const jobId = await enqueueLocalMediaForUpload(pickedFile, purpose);
          const newItem: PostDraftMediaItem = { jobId, previewUri: pickedFile.uri, mediaType: pickedFile.mediaType === "video" ? "video" : "image", width: pickedFile.width, height: pickedFile.height, durationSeconds: pickedFile.durationSeconds };
          setDraftMediaItems([...latestDraftMediaItems.current, newItem]);
        } catch (error) {
          rejectedMessages.push(error instanceof MediaValidationError ? error.message : "We couldn't add one of the files.");
        }
      }
      if (rejectedMessages.length > 0) showAlertWithButtons("Some files weren't added", [...new Set(rejectedMessages)].join("\n"));
    },
    [purpose, setDraftMediaItems],
  );

  const removeDraftMediaItem = useCallback(
    (jobId: ID) => {
      cancelAndRemoveUpload(jobId);
      setDraftMediaItems(latestDraftMediaItems.current.filter((item) => item.jobId !== jobId));
    },
    [setDraftMediaItems],
  );

  const moveDraftMediaItem = useCallback(
    (jobId: ID, offset: -1 | 1) => {
      const items = [...latestDraftMediaItems.current];
      const from = items.findIndex((item) => item.jobId === jobId);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= items.length) return;
      [items[from], items[to]] = [items[to]!, items[from]!];
      setDraftMediaItems(items);
    },
    [setDraftMediaItems],
  );

  const discardAllDraftMedia = useCallback(() => {
    latestDraftMediaItems.current.forEach((item) => cancelAndRemoveUpload(item.jobId));
    setDraftMediaItems([]);
  }, [setDraftMediaItems]);

  const waitForAllDraftMediaIds = useCallback(
    () => Promise.all(draftMediaItems.map((item) => waitForReservedMediaId(item.jobId))),
    [draftMediaItems],
  );

  return {
    draftMediaItems,
    remainingMediaSlots: MAXIMUM_MEDIA_PER_POST - draftMediaItems.length,
    combinedUploadedFraction,
    addPickedMediaAndStartUploading,
    removeDraftMediaItem,
    moveDraftMediaItem,
    discardAllDraftMedia,
    waitForAllDraftMediaIds,
  };
}

export const convertDraftItemsToPreviewMedia = (items: readonly PostDraftMediaItem[]): Media[] =>
  items.map((item) => ({
    id: item.jobId,
    type: item.mediaType,
    url: item.previewUri,
    width: item.width ?? undefined,
    height: item.height ?? undefined,
    status: "ready",
  }));

export function fillProcessingPostMediaWithLocalPreviews(post: Post, items: readonly PostDraftMediaItem[]): Post {
  return {
    ...post,
    media: post.media.map((media, index) => {
      const localItem = items[index];
      if (!localItem || media.url) return media;
      return { ...media, url: localItem.previewUri, status: media.status === "processing" ? "ready" : media.status };
    }),
  };
}
