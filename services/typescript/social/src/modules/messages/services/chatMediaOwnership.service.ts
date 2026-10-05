import { forbidden, SocialError, unprocessable } from "../../../errors/social.error.js";
import type { ChatMediaAccess } from "../../../interfaces/chatMediaAccess.interface.js";
import type { MessageKindName } from "../models/message.model.js";

interface ChatMediaRule {
  readonly purposes: readonly string[];
  readonly mediaKind: string;
}

const rulesByMessageKind: Partial<Record<MessageKindName, ChatMediaRule>> = {
  voice: { purposes: ["voice"], mediaKind: "audio" },
  image: { purposes: ["chat"], mediaKind: "image" },
  video: { purposes: ["chat"], mediaKind: "video" },
  document: { purposes: ["chat", "document"], mediaKind: "document" },
};
export const encryptedMediaKind = "encrypted";
const usableStatuses = new Set(["uploaded", "processing", "ready"]);

export interface VerifiedChatMedia {
  readonly mediaId: string;
  readonly ready: boolean;
  readonly sizeBytes: number;
  readonly durationSeconds: number | undefined;
}

export async function verifyChatMediaOwnership(access: ChatMediaAccess | undefined, senderId: string, kind: MessageKindName, mediaId: string): Promise<VerifiedChatMedia> {
  const rule = rulesByMessageKind[kind];
  if (rule === undefined) throw unprocessable("MEDIA_NOT_ALLOWED", "This message kind has no media.");
  if (access === undefined) throw new SocialError(503, "MEDIA_UNAVAILABLE", "Media messages are temporarily unavailable.");
  const media = await access.describe(mediaId);
  if (media === undefined || media.ownerId !== senderId) throw forbidden("MEDIA_NOT_OWNED", "You can only send media you uploaded.");
  const kindMatches = media.kind === rule.mediaKind || (media.kind === encryptedMediaKind && media.purpose !== "document");
  if (!rule.purposes.includes(media.purpose) || !kindMatches) throw unprocessable("MEDIA_TYPE_MISMATCH", `This upload can't be sent as a ${kind} message.`);
  if (!usableStatuses.has(media.status)) throw unprocessable("MEDIA_NOT_USABLE", "This upload can't be sent.");
  return { mediaId: media.id, ready: media.status === "ready", sizeBytes: media.sizeBytes, durationSeconds: media.durationSeconds };
}

export async function signChatMediaUrls(access: ChatMediaAccess | undefined, viewerId: string, mediaIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const urls = new Map<string, string>();
  if (access === undefined) return urls;
  const signed = await Promise.all([...new Set(mediaIds)].map(async (mediaId) => [mediaId, await access.signForParticipant(mediaId, viewerId).catch(() => null)] as const));
  for (const [mediaId, url] of signed) if (url !== null) urls.set(mediaId, url);
  return urls;
}
