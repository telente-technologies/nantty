import { Directory, File, Paths } from "expo-file-system";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import * as Sharing from "expo-sharing";

import type { DownloadableMedia } from "@/types";
import { mapTransferProgressToOverall, pollUntilBrandedDownloadIsReady } from "@/utils/brandedDownloadPolling.util";
import { sanitizeFileNameForDevice } from "@/utils/chatDocument.util";

import { mediaDownloadsService } from "./mediaDownloads.service";

export interface SaveBrandedMediaOptions {
  readonly postId: string;
  readonly media: DownloadableMedia;
  readonly onProgress: (overallProgress: number) => void;
  readonly signal?: AbortSignal;
}

export type SaveBrandedMediaOutcome = "savedToLibrary" | "sharedInstead";

async function downloadSignedFileIntoCache(url: string, fileName: string, onProgress: (overallProgress: number) => void, signal?: AbortSignal): Promise<File> {
  const folder = new Directory(Paths.cache, "brandedDownloads");
  if (!folder.exists) folder.create();
  return File.downloadFileAsync(url, new File(folder, sanitizeFileNameForDevice(fileName)), {
    idempotent: true,
    ...(signal ? { signal } : {}),
    onProgress: ({ bytesWritten, totalBytes }) => onProgress(mapTransferProgressToOverall(bytesWritten, totalBytes)),
  });
}

export async function requestBrandedMediaLink(postId: string, mediaId: string, onProgress: (overallProgress: number) => void, signal?: AbortSignal) {
  return pollUntilBrandedDownloadIsReady({
    requestDownload: () => mediaDownloadsService.requestPostMediaDownload(postId, mediaId),
    onPreparingProgress: onProgress,
    ...(signal ? { signal } : {}),
  });
}

export async function saveBrandedPostMediaToDevice({ postId, media, onProgress, signal }: SaveBrandedMediaOptions): Promise<SaveBrandedMediaOutcome> {
  const ready = await requestBrandedMediaLink(postId, media.id, onProgress, signal);
  const fileName = ready.fileName ?? `zudomart-${media.id}.${media.type === "video" ? "mp4" : "jpg"}`;
  const file = await downloadSignedFileIntoCache(ready.url, fileName, onProgress, signal);
  const permission = await requestPermissionsAsync(true, [media.type === "video" ? "video" : "photo"]);
  if (permission.granted) {
    await Asset.create(file.uri);
    if (file.exists) file.delete();
    onProgress(1);
    return "savedToLibrary";
  }
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: ready.contentType ?? (media.type === "video" ? "video/mp4" : "image/jpeg") });
  onProgress(1);
  return "sharedInstead";
}
