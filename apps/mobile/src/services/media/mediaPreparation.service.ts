import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

import type { MediaUploadPurpose } from "@/types";

export interface LocalMediaFile {
  readonly uri: string;
  readonly mediaType: "image" | "video" | "audio";
  readonly mimeType: string | null;
  readonly fileName: string | null;
  readonly sizeBytes: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationSeconds: number | null;
}

export interface PreparedUploadFile {
  readonly fileUri: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly width: number | null;
  readonly height: number | null;
}

export class MediaValidationError extends Error {}

const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ALLOWED_AUDIO_MIME_TYPES = ["audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/mpeg", "audio/webm", "audio/ogg"];
const MAXIMUM_VOICE_NOTE_BYTES = 25 * 1024 * 1024;
const MEGABYTE = 1024 * 1024;
const MAXIMUM_IMAGE_BYTES_BEFORE_COMPRESSION = 40 * MEGABYTE;
const MAXIMUM_VIDEO_BYTES_BY_PURPOSE: Record<MediaUploadPurpose, number> = {
  post: 1024 * MEGABYTE,
  clip: 512 * MEGABYTE,
  story: 300 * MEGABYTE,
  chat: 200 * MEGABYTE,
  product: 300 * MEGABYTE,
  avatar: 0,
  banner: 0,
  voice: 0,
  document: 0,
  dispute_evidence: 100 * MEGABYTE,
  identity_document: 0,
  verification_document: 0,
};
const MAXIMUM_VIDEO_SECONDS_BY_PURPOSE: Partial<Record<MediaUploadPurpose, number>> = { story: 60, clip: 180, post: 600 };
const MAXIMUM_IMAGE_LONG_EDGE_PIXELS = 4096;
const IMAGE_COMPRESSION_QUALITY = 0.8;

const guessMimeTypeFromFileName = (fileName: string, mediaType: LocalMediaFile["mediaType"]) => {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const byExtension: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: mediaType === "audio" ? "audio/webm" : "video/webm",
    m4a: "audio/mp4",
    aac: "audio/aac",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
  };
  return byExtension[extension] ?? (mediaType === "image" ? "image/jpeg" : mediaType === "audio" ? "audio/mp4" : "video/mp4");
};

export function validateLocalMediaBeforeUpload(media: LocalMediaFile, purpose: MediaUploadPurpose) {
  const fileName = media.fileName ?? media.uri.split("/").pop() ?? "upload";
  const mimeType = (media.mimeType ?? guessMimeTypeFromFileName(fileName, media.mediaType)).toLowerCase();
  if (media.mediaType === "audio") {
    if (purpose !== "voice" && purpose !== "chat") throw new MediaValidationError("Audio can't be used here.");
    if (!ALLOWED_AUDIO_MIME_TYPES.includes(mimeType)) throw new MediaValidationError("This audio format isn't supported.");
    if ((media.sizeBytes ?? 0) > MAXIMUM_VOICE_NOTE_BYTES) throw new MediaValidationError("This voice note is too long.");
    return;
  }
  if (media.mediaType === "image") {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) throw new MediaValidationError("This photo format isn't supported.");
    if ((media.sizeBytes ?? 0) > MAXIMUM_IMAGE_BYTES_BEFORE_COMPRESSION) throw new MediaValidationError("This photo is too large.");
    return;
  }
  if (!ALLOWED_VIDEO_MIME_TYPES.includes(mimeType)) throw new MediaValidationError("This video format isn't supported.");
  const maximumVideoBytes = MAXIMUM_VIDEO_BYTES_BY_PURPOSE[purpose];
  if (maximumVideoBytes === 0) throw new MediaValidationError("Only photos can be used here.");
  if ((media.sizeBytes ?? 0) > maximumVideoBytes) throw new MediaValidationError("This video is too large.");
  const maximumSeconds = MAXIMUM_VIDEO_SECONDS_BY_PURPOSE[purpose];
  if (maximumSeconds && (media.durationSeconds ?? 0) > maximumSeconds) {
    throw new MediaValidationError(`Videos can be up to ${Math.round(maximumSeconds / 60)} minutes long.`);
  }
}

export async function resizeAndReencodeImageWithoutMetadata(media: LocalMediaFile) {
  const longEdge = Math.max(media.width ?? 0, media.height ?? 0);
  const context = ImageManipulator.manipulate(media.uri);
  if (longEdge > MAXIMUM_IMAGE_LONG_EDGE_PIXELS) {
    const isLandscape = (media.width ?? 0) >= (media.height ?? 0);
    context.resize(isLandscape ? { width: MAXIMUM_IMAGE_LONG_EDGE_PIXELS } : { height: MAXIMUM_IMAGE_LONG_EDGE_PIXELS });
  }
  const renderedImage = await context.renderAsync();
  const saved = await renderedImage.saveAsync({ compress: IMAGE_COMPRESSION_QUALITY, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

const getPersistentUploadsDirectory = () => {
  const uploadsDirectory = new Directory(Paths.document, "pendingUploads");
  if (!uploadsDirectory.exists) uploadsDirectory.create({ intermediates: true, idempotent: true });
  return uploadsDirectory;
};

async function measureFileSizeInBytes(fileUri: string, fallbackSizeBytes: number | null) {
  if (Platform.OS === "web") {
    const blob = await (await fetch(fileUri)).blob();
    return blob.size;
  }
  return new File(fileUri).size || fallbackSizeBytes || 0;
}

export async function prepareLocalMediaForChunkedUpload(
  media: LocalMediaFile,
  purpose: MediaUploadPurpose,
  jobId: string,
): Promise<PreparedUploadFile> {
  validateLocalMediaBeforeUpload(media, purpose);
  const originalFileName = media.fileName ?? media.uri.split("/").pop() ?? `${jobId}`;
  if (media.mediaType === "image") {
    const compressed = await resizeAndReencodeImageWithoutMetadata(media);
    const fileUri = Platform.OS === "web" ? compressed.uri : moveIntoPersistentUploadsDirectory(compressed.uri, `${jobId}.jpg`);
    return {
      fileUri,
      fileName: `${originalFileName.replace(/\.[^.]+$/, "")}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: await measureFileSizeInBytes(fileUri, null),
      width: compressed.width,
      height: compressed.height,
    };
  }
  const mimeType = (media.mimeType ?? guessMimeTypeFromFileName(originalFileName, media.mediaType)).toLowerCase();
  const extension = originalFileName.includes(".") ? originalFileName.split(".").pop()!.toLowerCase() : media.mediaType === "audio" ? "m4a" : "mp4";
  const fileUri = Platform.OS === "web" ? media.uri : copyIntoPersistentUploadsDirectory(media.uri, `${jobId}.${extension}`);
  return {
    fileUri,
    fileName: originalFileName,
    mimeType,
    sizeBytes: await measureFileSizeInBytes(fileUri, media.sizeBytes),
    width: media.width,
    height: media.height,
  };
}

function moveIntoPersistentUploadsDirectory(sourceUri: string, targetFileName: string) {
  const target = new File(getPersistentUploadsDirectory(), targetFileName);
  if (target.exists) target.delete();
  new File(sourceUri).moveSync(target);
  return target.uri;
}

function copyIntoPersistentUploadsDirectory(sourceUri: string, targetFileName: string) {
  const target = new File(getPersistentUploadsDirectory(), targetFileName);
  if (target.exists) target.delete();
  new File(sourceUri).copySync(target);
  return target.uri;
}

export function deletePreparedUploadFile(fileUri: string | null) {
  if (!fileUri || Platform.OS === "web") return;
  try {
    const file = new File(fileUri);
    if (file.exists && file.uri.includes("pendingUploads")) file.delete();
  } catch {
    return;
  }
}
