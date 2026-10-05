import { unprocessable } from "../../../errors/social.error.js";
import { chatMediaRetentionDays } from "../../../constants/social.constant.js";
import type { MessageDocument, MessageKindName, SharedContentReference, SharedLocation } from "../models/message.model.js";

export const maximumDocumentBytes = 100 * 1024 * 1024;
export const maximumLiveLocationMilliseconds = 8 * 60 * 60 * 1000;
const maximumCiphertextLength = 65_536;
const maximumLinkPreviewLength = 8_192;
const allowedProtocols = new Set(["signal-v1-pending", "signal-v1"]);

export interface OutgoingMessageInput {
  readonly kind: MessageKindName;
  readonly text: string | undefined;
  readonly encryption: { readonly deviceId: string; readonly ciphertext: string; readonly protocol?: string | undefined } | undefined;
  readonly media: { readonly mediaId: string; readonly durationSeconds: number | undefined } | undefined;
  readonly linkPreview: string | null | undefined;
  readonly sharedContent: SharedContentReference | undefined;
  readonly location: { readonly latitude: number; readonly longitude: number; readonly address?: string | null | undefined; readonly liveUntil?: string | null | undefined } | undefined;
  readonly document: { readonly fileName: string; readonly mimeType: string; readonly sizeBytes: number; readonly pageCount?: number | null | undefined } | undefined;
  readonly poll: { readonly question: string; readonly allowMultipleAnswers: boolean; readonly options: readonly string[] } | undefined;
}

export interface ValidatedMessage {
  readonly kind: MessageKindName;
  readonly ciphertext: string | null;
  readonly deviceId: string | null;
  readonly protocol: string;
  readonly mediaType: "voice" | "image" | "video" | null;
  readonly media: OutgoingMessageInput["media"];
  readonly linkPreviewEnvelope: string | null;
  readonly sharedContent: SharedContentReference | null;
  readonly location: SharedLocation | null;
  readonly document: MessageDocument | null;
  readonly poll: { readonly question: string; readonly allowMultipleAnswers: boolean; readonly options: readonly string[] } | null;
  readonly mediaExpiresAt: Date | null;
}

const mediaKinds: readonly MessageKindName[] = ["voice", "image", "video"];

export function validateOutgoingMessage(input: OutgoingMessageInput, now: Date): ValidatedMessage {
  if (input.kind === "system") throw unprocessable("KIND_NOT_ALLOWED", "System messages are created by the server.");
  if (input.text !== undefined && input.text !== "" && input.kind !== "poll") {
    throw unprocessable("PLAINTEXT_NOT_ACCEPTED", "Messages are end-to-end encrypted: send an encryption envelope, never text.");
  }
  if (input.kind === "text" && input.encryption === undefined) throw unprocessable("ENCRYPTION_REQUIRED", "A text message needs an encryption envelope.");
  if (input.encryption !== undefined) {
    if (input.encryption.ciphertext.length === 0 || input.encryption.ciphertext.length > maximumCiphertextLength) throw unprocessable("CIPHERTEXT_INVALID", "The ciphertext is empty or too large.");
    if (input.encryption.protocol !== undefined && !allowedProtocols.has(input.encryption.protocol)) throw unprocessable("PROTOCOL_UNSUPPORTED", "Unsupported encryption protocol.");
  }
  if (input.linkPreview !== undefined && input.linkPreview !== null && input.linkPreview.length > maximumLinkPreviewLength) throw unprocessable("LINK_PREVIEW_TOO_LARGE", "The link preview envelope is too large.");
  const isMedia = mediaKinds.includes(input.kind);
  if (isMedia && input.media === undefined) throw unprocessable("MEDIA_REQUIRED", "This message needs a media id.");
  if (!isMedia && input.kind !== "document" && input.media !== undefined) throw unprocessable("MEDIA_NOT_ALLOWED", "This message kind has no media.");
  const location = validateLocation(input, now);
  const document = validateDocument(input);
  const poll = validatePoll(input);
  if (input.kind === "shared" && input.sharedContent === undefined) throw unprocessable("SHARED_CONTENT_REQUIRED", "A shared message needs a reference.");
  const retainsMedia = isMedia || input.kind === "document";
  return {
    kind: input.kind,
    ciphertext: input.encryption?.ciphertext ?? null,
    deviceId: input.encryption?.deviceId ?? null,
    protocol: input.encryption?.protocol ?? "signal-v1-pending",
    mediaType: isMedia ? (input.kind as "voice" | "image" | "video") : null,
    media: input.media,
    linkPreviewEnvelope: input.linkPreview ?? null,
    sharedContent: input.sharedContent ?? null,
    location,
    document,
    poll,
    mediaExpiresAt: retainsMedia ? new Date(now.getTime() + chatMediaRetentionDays * 86_400_000) : null,
  };
}

function validateLocation(input: OutgoingMessageInput, now: Date): SharedLocation | null {
  if (input.kind !== "location" && input.kind !== "liveLocation") return null;
  const location = input.location;
  if (location === undefined) throw unprocessable("LOCATION_REQUIRED", "A location message needs coordinates.");
  if (!(location.latitude >= -90 && location.latitude <= 90 && location.longitude >= -180 && location.longitude <= 180)) throw unprocessable("LOCATION_INVALID", "The coordinates are out of range.");
  const base = { latitude: location.latitude, longitude: location.longitude, address: location.address ?? null, updatedAt: now.toISOString() };
  if (input.kind === "location") return base;
  const liveUntil = location.liveUntil === undefined || location.liveUntil === null ? undefined : new Date(location.liveUntil);
  if (liveUntil === undefined || Number.isNaN(liveUntil.getTime()) || liveUntil <= now || liveUntil.getTime() - now.getTime() > maximumLiveLocationMilliseconds) {
    throw unprocessable("LIVE_UNTIL_INVALID", "Live location can be shared for up to 8 hours.");
  }
  return { ...base, liveUntil: liveUntil.toISOString() };
}

function validateDocument(input: OutgoingMessageInput): MessageDocument | null {
  if (input.kind !== "document") return null;
  const document = input.document;
  if (document === undefined) throw unprocessable("DOCUMENT_REQUIRED", "A document message needs file details.");
  if (document.sizeBytes <= 0 || document.sizeBytes > maximumDocumentBytes) throw unprocessable("DOCUMENT_TOO_LARGE", "Documents can be up to 100 MB.");
  if (input.media === undefined) throw unprocessable("MEDIA_REQUIRED", "Upload the document first and send its media id.");
  return { fileName: document.fileName.slice(0, 200), mimeType: document.mimeType, sizeBytes: document.sizeBytes, pageCount: document.pageCount ?? null, url: null };
}

function validatePoll(input: OutgoingMessageInput): OutgoingMessageInput["poll"] & object | null {
  if (input.kind !== "poll") return null;
  const poll = input.poll;
  if (poll === undefined) throw unprocessable("POLL_REQUIRED", "A poll message needs a question and options.");
  const options = poll.options.map((option) => option.trim());
  if (poll.question.trim() === "" || options.length < 2 || options.length > 6 || options.some((option) => option === "")) throw unprocessable("POLL_INVALID", "A poll needs a question and 2 to 6 options.");
  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) throw unprocessable("POLL_OPTIONS_NOT_UNIQUE", "Poll options must be different.");
  return { question: poll.question.trim(), allowMultipleAnswers: poll.allowMultipleAnswers, options };
}
