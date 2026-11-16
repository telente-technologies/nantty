import { randomUUID } from "expo-crypto";
import { File, Paths, UploadType } from "expo-file-system";

import type { MessengerRequest } from "./messengerChat.service";
import { uploadMediaBytes, type MediaUploadRequest } from "./messengerMediaUpload.service";

export function uploadMessengerMedia(request: MessengerRequest, metadata: MediaUploadRequest, bytes: Uint8Array): Promise<string> {
  return uploadMediaBytes(request, metadata, bytes, async (url, chunk, headers) => {
    const temporary = new File(Paths.cache, `nantty-media-${randomUUID()}.bin`);
    temporary.create({ overwrite: true });
    temporary.write(chunk);
    try {
      const response = await temporary.upload(url, {
        httpMethod: "PUT",
        uploadType: UploadType.BINARY_CONTENT,
        ...(headers ? { headers: { ...headers } } : {}),
        sessionType: "foreground",
      });
      if (response.status < 200 || response.status >= 300) throw new Error("Media upload failed. Please try again.");
    } finally {
      if (temporary.exists) temporary.delete();
    }
  });
}
