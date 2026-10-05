import { shouldUseMockForPath } from "@/config/api.config";

import { api } from "./apiClient.service";

export type ProfileImagePurpose = "avatar" | "banner";

export interface ProfileImageUploadIntent {
  readonly mediaId: string;
  readonly uploadUrl: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly publicUrl: string;
  readonly expiresAt: string;
  readonly maximumSize?: number;
}

export const PROFILE_IMAGE_INTENT_PATH = "/api/v1/users/me/media/upload-intents";

export async function uploadProfileImageAndReturnMediaId(localUri: string, contentType: string, purpose: ProfileImagePurpose): Promise<string> {
  if (shouldUseMockForPath(PROFILE_IMAGE_INTENT_PATH)) {
    const mockIntent = await api.post<ProfileImageUploadIntent>(PROFILE_IMAGE_INTENT_PATH, { purpose, contentType, sizeBytes: 1, previewUri: localUri });
    return mockIntent.mediaId;
  }
  const blob = await (await fetch(localUri)).blob();
  const intent = await api.post<ProfileImageUploadIntent>(PROFILE_IMAGE_INTENT_PATH, { purpose, contentType, sizeBytes: blob.size });
  const response = await fetch(intent.uploadUrl, { method: intent.method, headers: intent.headers, body: blob });
  if (!response.ok) throw new Error("Couldn't upload your photo. Try again.");
  return intent.mediaId;
}
