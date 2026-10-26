"use client";

import type { GroupAttributes } from "@nantty/chat-crypto";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/components/providers/sessionProvider";
import { chatCryptoService } from "@/services/chatCrypto/chatCrypto.service";
import { chatGroupsService } from "@/services/chatGroups.service";
import type { Conversation } from "@/types";
import { groupFallbackName } from "@/utils/chatThread.util";

import { useGroupPhotoUrl } from "./groupPhoto.hook";

export const groupAttributesQueryKey = (conversationId: string) => ["chatGroupAttributes", conversationId] as const;

export interface ConversationDisplay {
  readonly name: string;
  readonly subtitle: string | null;
  readonly avatarSrc: string | null;
  readonly isGroup: boolean;
  readonly attributes: GroupAttributes | null;
  readonly isEncryptedNamePending: boolean;
}

export function useConversationDisplay(conversation: Conversation | undefined, options: { readonly loadMembersForFallback?: boolean } = {}): ConversationDisplay {
  const { viewer } = useSession();
  const isGroup = conversation?.kind === "group";
  const sealed = conversation?.encryptedAttributes ?? null;
  const attributesQuery = useQuery({
    queryKey: [...groupAttributesQueryKey(conversation?.id ?? ""), sealed],
    queryFn: () => chatCryptoService.openGroupAttributes(viewer?.id ?? "", conversation?.id ?? "", sealed),
    enabled: isGroup && Boolean(sealed) && Boolean(viewer?.id),
    staleTime: 30_000,
  });
  const attributes = attributesQuery.data ?? null;
  const groupPhotoUrl = useGroupPhotoUrl(conversation, attributes);
  const membersQuery = useQuery({
    queryKey: ["conversation-members", conversation?.id ?? ""],
    queryFn: () => chatGroupsService.fetchMembers(conversation?.id ?? ""),
    enabled: isGroup && options.loadMembersForFallback !== false && attributes === null && !attributesQuery.isPending,
    staleTime: 60_000,
  });
  if (!conversation) return { name: "Conversation", subtitle: null, avatarSrc: null, isGroup: false, attributes: null, isEncryptedNamePending: false };
  if (!isGroup) {
    if (conversation.kind === "business") return { name: conversation.store?.name || "Store", subtitle: "Store chat", avatarSrc: conversation.store?.avatarUrl ?? null, isGroup: false, attributes: null, isEncryptedNamePending: false };
    return { name: conversation.title ?? conversation.store?.name ?? conversation.peer.name, subtitle: conversation.kind === "channel" ? null : `@${conversation.peer.username}`, avatarSrc: conversation.photoUrl ?? conversation.peer.avatarUrl, isGroup: false, attributes: null, isEncryptedNamePending: false };
  }
  const memberNames = (membersQuery.data ?? []).filter((member) => member.user.id !== viewer?.id).map((member) => member.user.name);
  const memberCount = conversation.memberCount ?? membersQuery.data?.length;
  return {
    name: attributes?.title ?? groupFallbackName(memberNames),
    subtitle: attributes?.description ?? (memberCount ? `${memberCount} members` : null),
    avatarSrc: groupPhotoUrl,
    isGroup: true,
    attributes,
    isEncryptedNamePending: Boolean(sealed) && attributes === null,
  };
}
