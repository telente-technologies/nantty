import { unprocessable } from "../../../errors/social.error.js";
import { chatMediaRetentionDays } from "../../../constants/social.constant.js";
import type { MessageKindName } from "../models/message.model.js";

const maximumCiphertextLength = 65_536;
const maximumLinkPreviewLength = 8_192;
const allowedProtocols = new Set(["signal-v1"]);
export const plaintextFields = ["text", "location", "poll", "document", "sharedContent"] as const;
export type PlaintextField = (typeof plaintextFields)[number];

export interface OutgoingMessageInput {
  readonly kind: MessageKindName;
  readonly encryption: { readonly deviceId: string; readonly ciphertext: string; readonly protocol?: string | undefined } | undefined;
  readonly media: { readonly mediaId: string; readonly durationSeconds: number | undefined } | undefined;
  readonly linkPreview: string | null | undefined;
  readonly plaintext?: Partial<Record<PlaintextField, unknown>>;
}

export interface ValidatedMessage {
  readonly kind: MessageKindName;
  readonly ciphertext: string;
  readonly deviceId: string;
  readonly protocol: string;
  readonly mediaType: "voice" | "image" | "video" | null;
  readonly media: OutgoingMessageInput["media"];
  readonly linkPreviewEnvelope: string | null;
  readonly mediaExpiresAt: Date | null;
}

const mediaKinds: readonly MessageKindName[] = ["voice", "image", "video"];

export function assertNoPlaintext(plaintext: OutgoingMessageInput["plaintext"]): void {
  const sent = plaintextFields.filter((field) => {
    const value = plaintext?.[field];
    return value !== undefined && value !== null && value !== "";
  });
  if (sent.length > 0) {
    throw unprocessable("PLAINTEXT_NOT_ACCEPTED", "Chats are end-to-end encrypted. Update Nantty to send this: text, locations, polls, documents and shared items must be inside the encrypted message.", { fields: sent });
  }
}

export function validateOutgoingMessage(input: OutgoingMessageInput, now: Date): ValidatedMessage {
  if (input.kind === "system") throw unprocessable("KIND_NOT_ALLOWED", "System messages are created by the server.");
  assertNoPlaintext(input.plaintext);
  const encryption = input.encryption;
  if (encryption === undefined) throw unprocessable("ENCRYPTION_REQUIRED", "Every chat message needs an encryption envelope.");
  if (encryption.ciphertext.length === 0 || encryption.ciphertext.length > maximumCiphertextLength) throw unprocessable("CIPHERTEXT_INVALID", "The ciphertext is empty or too large.");
  const protocol = encryption.protocol ?? "signal-v1";
  if (!allowedProtocols.has(protocol)) throw unprocessable("PROTOCOL_UNSUPPORTED", "Unsupported encryption protocol.");
  if (input.linkPreview !== undefined && input.linkPreview !== null && input.linkPreview.length > maximumLinkPreviewLength) throw unprocessable("LINK_PREVIEW_TOO_LARGE", "The link preview envelope is too large.");
  const isMedia = mediaKinds.includes(input.kind);
  if (isMedia && input.media === undefined) throw unprocessable("MEDIA_REQUIRED", "This message needs a media id.");
  if (input.kind === "document" && input.media === undefined) throw unprocessable("MEDIA_REQUIRED", "Upload the encrypted document first and send its media id.");
  if (!isMedia && input.kind !== "document" && input.media !== undefined) throw unprocessable("MEDIA_NOT_ALLOWED", "This message kind has no media.");
  if (input.kind === "control" && input.linkPreview) throw unprocessable("LINK_PREVIEW_NOT_ALLOWED", "Control messages carry no link preview.");
  const retainsMedia = isMedia || input.kind === "document";
  return {
    kind: input.kind,
    ciphertext: encryption.ciphertext,
    deviceId: encryption.deviceId,
    protocol,
    mediaType: isMedia ? (input.kind as "voice" | "image" | "video") : null,
    media: input.media,
    linkPreviewEnvelope: input.linkPreview ?? null,
    mediaExpiresAt: retainsMedia ? new Date(now.getTime() + chatMediaRetentionDays * 86_400_000) : null,
  };
}
