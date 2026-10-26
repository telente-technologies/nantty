import type { GroupAttributes, GroupAvatar } from "@nantty/chat-crypto";

import type { Conversation } from "@/types";

import { chatCryptoService } from "../chatCrypto/chatCrypto.service";
import { resolveDecryptedImageInMemory } from "../chatCrypto/encryptedAttachments.service";

export const groupFallbackTitle = "Group";

export function selectVerifiedGroupAvatar(conversation: Pick<Conversation, "photoMediaId" | "photoUrl">, attributes: GroupAttributes | null): GroupAvatar | null {
  const avatar = attributes?.avatar ?? null;
  if (!avatar || !conversation.photoUrl || !conversation.photoMediaId || avatar.mediaId !== conversation.photoMediaId) return null;
  return avatar.pointer.contentType.startsWith("image/") ? avatar : null;
}

export async function withDecryptedGroupDetails<T extends Conversation>(conversation: T): Promise<T> {
  if (conversation.kind !== "group") return conversation;
  const attributes = await chatCryptoService.openGroupAttributes(conversation.id, conversation.encryptedAttributes).catch(() => null);
  const avatar = selectVerifiedGroupAvatar(conversation, attributes);
  const photoUrl = avatar && conversation.photoUrl ? await resolveDecryptedImageInMemory(avatar.mediaId, conversation.photoUrl, avatar.pointer).catch(() => null) : null;
  return {
    ...conversation, title: attributes?.title ?? conversation.title ?? null, description: attributes?.description ?? conversation.description ?? null,
    hasGroupKey: attributes !== null, groupAvatar: attributes?.avatar ?? null, photoUrl,
  };
}

export const withDecryptedGroupDetailsForAll = <T extends Conversation>(conversations: readonly T[]): Promise<T[]> => Promise.all(conversations.map(withDecryptedGroupDetails));

export const matchesGroupTitle = (conversation: Conversation, query: string) =>
  conversation.kind === "group" && !!conversation.title && conversation.title.toLowerCase().includes(query.trim().toLowerCase());
