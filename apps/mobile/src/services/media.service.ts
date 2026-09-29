import { apiConfig } from "@/config/api.config";

import { api } from "./apiClient.service";

export type MediaUploadPurpose = "avatar" | "banner" | "product" | "post";

interface SignedUpload {
  readonly uploadUrl: string;
  readonly fileUrl: string;
}

export const mediaService = {
  requestSignedUploadUrl: (contentType: string, purpose: MediaUploadPurpose) =>
    api.post<SignedUpload>("/api/v1/media/uploads", { contentType, purpose }),
  uploadLocalImageAndReturnPublicUrl: async (localUri: string, contentType: string, purpose: MediaUploadPurpose) => {
    if (apiConfig.useMocks) return localUri;
    const { uploadUrl, fileUrl } = await mediaService.requestSignedUploadUrl(contentType, purpose);
    const file = await (await fetch(localUri)).blob();
    const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
    if (!response.ok) throw new Error("Upload failed. Please try again.");
    return fileUrl;
  },
};
