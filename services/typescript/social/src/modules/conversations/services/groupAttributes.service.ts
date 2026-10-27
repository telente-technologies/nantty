import { unprocessable } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { verifyChatMediaOwnership } from "../../messages/services/chatMediaOwnership.service.js";

const sealedPattern = /^[A-Za-z0-9+/]+={0,2}$/;
const minimumSealedLength = 64;

export function assertNoPlaintextGroupName(name: unknown): void {
  if (name !== undefined && name !== null && name !== "") {
    throw unprocessable("PLAINTEXT_NOT_ACCEPTED", "Group names and photos are end-to-end encrypted. Update Nantty to create or rename groups.", { fields: ["name"] });
  }
}

export function requireSealedGroupAttributes(plaintextName: unknown, encryptedAttributes: string | undefined): string {
  assertNoPlaintextGroupName(plaintextName);
  if (encryptedAttributes === undefined || encryptedAttributes.length < minimumSealedLength || !sealedPattern.test(encryptedAttributes)) {
    throw unprocessable("ENCRYPTION_REQUIRED", "A new group needs its encrypted details.");
  }
  return encryptedAttributes;
}

export async function verifyEncryptedGroupPhoto(context: HandlerContext, actorId: string, mediaId: string | null | undefined): Promise<void> {
  if (mediaId === undefined || mediaId === null) return;
  await verifyChatMediaOwnership(context.chatMedia, actorId, "image", mediaId);
}
