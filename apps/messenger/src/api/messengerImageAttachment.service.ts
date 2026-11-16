import { decryptAttachment, encryptAttachment, encodeBase64, encryptedAttachmentMimeType, type AttachmentPointer } from "@nantty/chat-crypto";
import { File, Paths, UploadType } from "expo-file-system";
import { getRandomBytes } from "expo-crypto";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

import type { MessengerRequest } from "./messengerChat.service";

const maximumImageBytes = 10 * 1024 * 1024;
const maximumImageEdge = 1600;

interface UploadSession {
  readonly uploadId: string;
  readonly mode: "single" | "multipart";
  readonly url?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly chunkSizeBytes: number;
  readonly totalChunks: number;
  readonly uploadedChunks: readonly number[];
}

async function readFile(uri: string): Promise<Uint8Array> {
  if (Platform.OS === "web") return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  return new File(uri).bytes();
}

export async function uploadEncryptedMessengerImage(request: MessengerRequest, image: { readonly uri: string; readonly width: number; readonly height: number }): Promise<{ readonly mediaId: string; readonly pointer: AttachmentPointer }> {
  const transform = ImageManipulator.manipulate(image.uri);
  if (Math.max(image.width, image.height) > maximumImageEdge) {
    transform.resize(image.width >= image.height ? { width: maximumImageEdge } : { height: maximumImageEdge });
  }
  const rendered = await transform.renderAsync();
  const prepared = await rendered.saveAsync({ compress: 0.78, format: SaveFormat.JPEG });
  try {
    const plaintext = await readFile(prepared.uri);
    if (plaintext.byteLength > maximumImageBytes) throw new Error("This image is too large to send securely. Choose a smaller image.");
    const thumbnail = await ImageManipulator.manipulate(prepared.uri).resize({ width: 24 }).renderAsync().then((value) => value.saveAsync({ compress: 0.4, format: SaveFormat.JPEG, base64: true })).then((value) => value.base64 ?? null).catch(() => null);
    const encrypted = encryptAttachment(plaintext, { contentType: "image/jpeg", width: prepared.width, height: prepared.height, thumbnail }, getRandomBytes);
    const session = await request<UploadSession & { readonly mediaId: string }>("/api/v1/media/uploads", {
      method: "POST",
      body: { fileName: "encrypted-image.bin", mimeType: encryptedAttachmentMimeType, sizeBytes: encrypted.blob.byteLength, purpose: "chat", sha256: encrypted.sha256Hex },
    });
    try {
      if (session.mode === "single") {
        if (!session.url) throw new Error("The secure image upload could not be started. Please try again.");
        const encryptedFile = new File(Paths.cache, `nantty-upload-${Date.now()}.bin`);
        encryptedFile.create({ overwrite: true });
        encryptedFile.write(encrypted.blob);
        try {
          const result = await encryptedFile.upload(session.url, { httpMethod: "PUT", uploadType: UploadType.BINARY_CONTENT, headers: { ...session.headers }, sessionType: "foreground" });
          if (result.status < 200 || result.status >= 300) throw new Error("Image upload failed. Please try again.");
        } finally {
          if (encryptedFile.exists) encryptedFile.delete();
        }
      } else {
        for (let index = 0; index < session.totalChunks; index++) {
          if (session.uploadedChunks.includes(index)) continue;
          const target = await request<{ readonly url: string }>(`/api/v1/media/uploads/${encodeURIComponent(session.uploadId)}/chunks/${index}/url`);
          const bytes = encrypted.blob.slice(index * session.chunkSizeBytes, (index + 1) * session.chunkSizeBytes);
          const chunkFile = new File(Paths.cache, `nantty-upload-${Date.now()}-${index}.bin`);
          chunkFile.create({ overwrite: true });
          chunkFile.write(bytes);
          try {
            const result = await chunkFile.upload(target.url, { httpMethod: "PUT", uploadType: UploadType.BINARY_CONTENT, sessionType: "foreground" });
            if (result.status < 200 || result.status >= 300) throw new Error("Image upload failed. Please try again.");
          } finally {
            if (chunkFile.exists) chunkFile.delete();
          }
        }
      }
      const completed = await request<{ readonly mediaId: string }>(`/api/v1/media/uploads/${encodeURIComponent(session.uploadId)}/complete`, { method: "POST" });
      return { mediaId: completed.mediaId, pointer: encrypted.pointer };
    } catch (error) {
      await request<void>(`/api/v1/media/uploads/${encodeURIComponent(session.uploadId)}`, { method: "DELETE" }).catch(() => undefined);
      throw error;
    }
  } finally {
    if (Platform.OS !== "web") {
      const temporaryImage = new File(prepared.uri);
      if (temporaryImage.exists) temporaryImage.delete();
    }
  }
}

const maximumDecryptedCacheBytes = 24 * 1024 * 1024;
const decryptedImages = new Map<string, { readonly promise: Promise<string>; bytes: number }>();

export async function decryptMessengerImage(mediaId: string, url: string, pointer: AttachmentPointer): Promise<string> {
  const key = `${mediaId}:${pointer.digest}`;
  const cached = decryptedImages.get(key);
  if (cached) {
    decryptedImages.delete(key);
    decryptedImages.set(key, cached);
    return cached.promise;
  }
  if (pointer.sizeBytes > maximumImageBytes) throw new Error("IMAGE_TOO_LARGE");
  const entry: { promise: Promise<string>; bytes: number } = { promise: Promise.resolve(""), bytes: 0 };
  entry.promise = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error("IMAGE_UNAVAILABLE");
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maximumImageBytes + 28) throw new Error("IMAGE_TOO_LARGE");
    const encryptedBytes = new Uint8Array(await response.arrayBuffer());
    if (encryptedBytes.byteLength > maximumImageBytes + 28) throw new Error("IMAGE_TOO_LARGE");
    const plaintext = decryptAttachment(encryptedBytes, pointer);
    const encoded = encodeBase64(plaintext);
    entry.bytes = plaintext.byteLength + encoded.length * 2;
    if (entry.bytes > maximumDecryptedCacheBytes) throw new Error("IMAGE_TOO_LARGE");
    const uri = `data:${pointer.contentType};base64,${encoded}`;
    while ([...decryptedImages.values()].reduce((sum, value) => sum + value.bytes, 0) > maximumDecryptedCacheBytes - entry.bytes) {
      const oldest = decryptedImages.keys().next().value;
      if (!oldest || oldest === key) break;
      decryptedImages.delete(oldest);
    }
    return uri;
  }).catch((error: unknown) => {
    decryptedImages.delete(key);
    throw error;
  });
  decryptedImages.set(key, entry);
  return entry.promise;
}

export function clearDecryptedMessengerImages(): void {
  decryptedImages.clear();
}
