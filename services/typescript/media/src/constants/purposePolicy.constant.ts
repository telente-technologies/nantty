export type MediaPurposeName =
  | "post" | "clip" | "story" | "avatar" | "banner" | "product" | "chat" | "voice" | "document" | "kyc" | "adCreative"
  | "dispute_evidence" | "identity_document" | "verification_document";
export type MediaKindName = "image" | "video" | "audio" | "document" | "encrypted";

export const mebibyte = 1024 * 1024;

export const imageMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif"] as const;
export const videoMimeTypes = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const audioMimeTypes = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/webm", "audio/wav", "audio/x-wav"] as const;
export const documentMimeTypes = ["application/pdf"] as const;
export const encryptedChatMimeType = "application/vnd.zudomart.encrypted";

export interface PurposeRule {
  readonly kind: MediaKindName;
  readonly mimeTypes: readonly string[];
  readonly maximumBytes: number;
  readonly maximumDurationSeconds?: number;
}

export interface PurposePolicy {
  readonly isPrivate: boolean;
  readonly moderate: boolean;
  readonly retentionDays?: number;
  readonly rules: readonly PurposeRule[];
}

const image = (maximumMebibytes: number): PurposeRule => ({ kind: "image", mimeTypes: imageMimeTypes, maximumBytes: maximumMebibytes * mebibyte });
const video = (maximumMebibytes: number, maximumDurationSeconds: number): PurposeRule => ({ kind: "video", mimeTypes: videoMimeTypes, maximumBytes: maximumMebibytes * mebibyte, maximumDurationSeconds });
const audio = (maximumMebibytes: number, maximumDurationSeconds: number): PurposeRule => ({ kind: "audio", mimeTypes: audioMimeTypes, maximumBytes: maximumMebibytes * mebibyte, maximumDurationSeconds });
const document = (maximumMebibytes: number): PurposeRule => ({ kind: "document", mimeTypes: documentMimeTypes, maximumBytes: maximumMebibytes * mebibyte });
const encrypted = (maximumMebibytes: number): PurposeRule => ({ kind: "encrypted", mimeTypes: [encryptedChatMimeType], maximumBytes: maximumMebibytes * mebibyte + 4096 });

export const purposePolicies: Readonly<Record<MediaPurposeName, PurposePolicy>> = {
  post: { isPrivate: false, moderate: true, rules: [image(20), video(500, 600)] },
  clip: { isPrivate: false, moderate: true, rules: [video(500, 180)] },
  story: { isPrivate: false, moderate: true, rules: [image(20), video(100, 60)] },
  avatar: { isPrivate: false, moderate: true, rules: [image(5)] },
  banner: { isPrivate: false, moderate: true, rules: [image(10)] },
  product: { isPrivate: false, moderate: true, rules: [image(10), video(200, 120)] },
  adCreative: { isPrivate: false, moderate: false, rules: [image(10), video(200, 120)] },
  chat: { isPrivate: true, moderate: false, retentionDays: 30, rules: [image(20), video(100, 300), document(25), encrypted(100)] },
  voice: { isPrivate: true, moderate: false, retentionDays: 30, rules: [audio(10, 600), encrypted(10)] },
  document: { isPrivate: true, moderate: false, rules: [document(25), image(10)] },
  dispute_evidence: { isPrivate: true, moderate: false, rules: [document(25), image(10), video(100, 120)] },
  kyc: { isPrivate: true, moderate: false, rules: [document(10), image(10)] },
  identity_document: { isPrivate: true, moderate: false, rules: [document(10), image(10)] },
  verification_document: { isPrivate: true, moderate: false, rules: [document(10), image(10)] },
};

export const kycPurposes: ReadonlySet<MediaPurposeName> = new Set(["kyc", "identity_document", "verification_document"]);
export const profileImagePurposes: ReadonlySet<MediaPurposeName> = new Set(["avatar", "banner"]);

export const imageWidthsByPurpose: Readonly<Partial<Record<MediaPurposeName, readonly number[]>>> = {
  avatar: [96, 256, 512],
  banner: [640, 1280, 1920],
  product: [320, 640, 1080, 1600],
  chat: [640, 1080],
  kyc: [2000],
  identity_document: [2000],
  verification_document: [2000],
  document: [2000],
  dispute_evidence: [2000],
};
export const defaultImageWidths: readonly number[] = [480, 1080];
export const squareCropPurposes: ReadonlySet<MediaPurposeName> = new Set(["avatar"]);
