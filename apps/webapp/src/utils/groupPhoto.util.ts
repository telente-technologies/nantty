import type { AttachmentPointer, GroupAttributes } from "@zudomart/chat-crypto";

import type { Conversation } from "@/types";

export const maximumGroupPhotoBytes = 10 * 1024 * 1024;

export function groupPhotoSource(conversation: Pick<Conversation, "kind" | "photoUrl" | "photoMediaId"> | undefined, attributes: GroupAttributes | null): { readonly url: string; readonly pointer: AttachmentPointer; readonly mediaId: string } | null {
  if (!conversation || conversation.kind !== "group" || !conversation.photoUrl || !conversation.photoMediaId || !attributes?.avatar) return null;
  if (attributes.avatar.mediaId !== conversation.photoMediaId) return null;
  if (!attributes.avatar.pointer.contentType.startsWith("image/")) return null;
  return { url: conversation.photoUrl, pointer: attributes.avatar.pointer, mediaId: attributes.avatar.mediaId };
}

export function validateGroupPhotoFile(file: Pick<File, "type" | "size">): string | null {
  if (!file.type.startsWith("image/")) return "Choose a photo.";
  if (file.size > maximumGroupPhotoBytes) return "Group photos can be up to 10 MB.";
  return null;
}
