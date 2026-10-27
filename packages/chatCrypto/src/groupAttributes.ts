import { concatBytes, decodeBase64, encodeBase64, utf8Decode, utf8Encode } from "./bytes.util";
import { type AttachmentPointer, sanitizeAttachmentPointer } from "./attachments";
import { ChatCryptoError } from "./errors";
import { type RandomSource, aeadKeyLength, aeadNonceLength, openAead, sealAead } from "./primitives";

export interface GroupAvatar {
  readonly mediaId: string;
  readonly pointer: AttachmentPointer;
}

export interface GroupAttributes {
  readonly title: string;
  readonly description: string | null;
  readonly avatar: GroupAvatar | null;
}

export const maximumSealedGroupAttributesLength = 16_384;
const groupAttributesAssociatedData = utf8Encode("nantty-group-attributes-v1");
const isString = (value: unknown): value is string => typeof value === "string";

export function createGroupKey(random: RandomSource): string {
  return encodeBase64(random(aeadKeyLength));
}

export function sanitizeGroupAttributes(value: unknown): GroupAttributes | null {
  if (value === null || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (!isString(candidate.title) || candidate.title.trim() === "") return null;
  const avatar = candidate.avatar as Record<string, unknown> | null | undefined;
  const pointer = avatar && isString(avatar.mediaId) ? sanitizeAttachmentPointer(avatar.pointer) : null;
  return {
    title: candidate.title.trim().slice(0, 80),
    description: isString(candidate.description) && candidate.description.trim() !== "" ? candidate.description.trim().slice(0, 500) : null,
    avatar: pointer === null || !avatar ? null : { mediaId: String(avatar.mediaId).slice(0, 64), pointer },
  };
}

export function sealGroupAttributes(attributes: GroupAttributes, groupKey: string, random: RandomSource): string {
  const clean = sanitizeGroupAttributes(attributes);
  if (clean === null) throw new ChatCryptoError("INVALID_MESSAGE", "A group needs a name.");
  const nonce = random(aeadNonceLength);
  const sealed = encodeBase64(concatBytes(nonce, sealAead(decodeBase64(groupKey), nonce, utf8Encode(JSON.stringify({ v: 1, ...clean })), groupAttributesAssociatedData)));
  if (sealed.length > maximumSealedGroupAttributesLength) throw new ChatCryptoError("ENVELOPE_TOO_LARGE", "The group details are too large.");
  return sealed;
}

export function openGroupAttributes(sealed: string, groupKeys: readonly string[]): GroupAttributes | null {
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(sealed);
  } catch {
    return null;
  }
  for (const key of groupKeys) {
    try {
      const plaintext = openAead(decodeBase64(key), bytes.slice(0, aeadNonceLength), bytes.slice(aeadNonceLength), groupAttributesAssociatedData);
      const parsed = JSON.parse(utf8Decode(plaintext)) as Record<string, unknown>;
      if (parsed.v === 1) return sanitizeGroupAttributes(parsed);
    } catch {
      continue;
    }
  }
  return null;
}
