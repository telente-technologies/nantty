import { type Bytes, utf8Decode, utf8Encode } from "./bytes.util";
import { type AttachmentPointer, sanitizeAttachmentPointer } from "./attachments";
import { ChatCryptoError } from "./errors";

export interface ChatLinkPreview {
  readonly url: string;
  readonly domain: string;
  readonly title: string;
  readonly description: string | null;
  readonly imageUrl: string | null;
  readonly siteName?: string | null;
  readonly imageMediaId?: string | null;
}

export interface ChatPayload {
  readonly v: 1;
  readonly text: string;
  readonly sentAt: string;
  readonly conversationId?: string;
  readonly storyId?: string;
  readonly linkPreview?: ChatLinkPreview | null;
  readonly linkPreviewKey?: string;
  readonly sharedContent?: { readonly kind: string; readonly id: string } | null;
  readonly attachment?: AttachmentPointer | null;
}

export type ChatPayloadInput = Omit<ChatPayload, "v" | "sentAt" | "linkPreviewKey"> & { readonly sentAt?: string };

const maximumTextLength = 4000;
const isString = (value: unknown): value is string => typeof value === "string";
const isOptionalString = (value: unknown) => value === undefined || value === null || isString(value);

export function sanitizeLinkPreview(value: unknown): ChatLinkPreview | null {
  if (value === null || value === undefined || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (!isString(candidate.url) || !/^https?:\/\//i.test(candidate.url) || !isString(candidate.title) || !isString(candidate.domain)) return null;
  if (![candidate.description, candidate.imageUrl, candidate.siteName, candidate.imageMediaId].every(isOptionalString)) return null;
  const imageUrl = isString(candidate.imageUrl) && /^https:\/\//i.test(candidate.imageUrl) ? candidate.imageUrl : null;
  return {
    url: candidate.url.slice(0, 2048), domain: candidate.domain.slice(0, 255), title: candidate.title.slice(0, 300),
    description: isString(candidate.description) ? candidate.description.slice(0, 500) : null, imageUrl, siteName: isString(candidate.siteName) ? candidate.siteName.slice(0, 120) : null,
    imageMediaId: isString(candidate.imageMediaId) ? candidate.imageMediaId.slice(0, 64) : null,
  };
}

export function encodePayload(input: ChatPayloadInput, now: Date): Bytes {
  const payload: ChatPayload = { ...input, v: 1, text: input.text.slice(0, maximumTextLength), sentAt: input.sentAt ?? now.toISOString() };
  return utf8Encode(JSON.stringify(payload));
}

export function decodePayload(bytes: Bytes): ChatPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(utf8Decode(bytes));
  } catch {
    throw new ChatCryptoError("INVALID_MESSAGE", "The message payload is malformed.");
  }
  const candidate = parsed as Record<string, unknown>;
  if (parsed === null || typeof parsed !== "object" || candidate.v !== 1 || !isString(candidate.text) || !isString(candidate.sentAt)) {
    throw new ChatCryptoError("INVALID_MESSAGE", "The message payload is malformed.");
  }
  const shared = candidate.sharedContent as Record<string, unknown> | null | undefined;
  return {
    v: 1, text: candidate.text.slice(0, maximumTextLength), sentAt: candidate.sentAt,
    ...(isString(candidate.conversationId) ? { conversationId: candidate.conversationId } : {}),
    ...(isString(candidate.storyId) ? { storyId: candidate.storyId } : {}),
    ...(isString(candidate.linkPreviewKey) && candidate.linkPreviewKey.length === 44 ? { linkPreviewKey: candidate.linkPreviewKey } : {}),
    linkPreview: sanitizeLinkPreview(candidate.linkPreview),
    sharedContent: shared && isString(shared.kind) && isString(shared.id) ? { kind: shared.kind, id: shared.id } : null,
    attachment: sanitizeAttachmentPointer(candidate.attachment),
  };
}
