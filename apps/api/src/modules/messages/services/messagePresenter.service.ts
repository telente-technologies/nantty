import type { StoreSummary } from "../../../interfaces/storeAccess.interface.js";
import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import type { MessageDto, MessageReactionSummaryDto, StoreIdentityDto } from "../dtos/messages.dto.js";
import { SYSTEM_SENDER_ID, type MessageRecord, type ReactionRecord } from "../models/messages.model.js";
import type { MessagesService } from "./messages.service.js";

export function convertStoreToIdentity(store: StoreSummary): StoreIdentityDto {
  return { id: store.id, name: store.name, logoUrl: store.logoUrl };
}

export function summarizeReactions(reactions: readonly ReactionRecord[], viewerId: string): readonly MessageReactionSummaryDto[] {
  const byEmoji = new Map<string, { count: number; reactedByMe: boolean }>();
  for (const reaction of reactions) {
    const current = byEmoji.get(reaction.emoji) ?? { count: 0, reactedByMe: false };
    byEmoji.set(reaction.emoji, { count: current.count + 1, reactedByMe: current.reactedByMe || reaction.userId === viewerId });
  }
  return [...byEmoji.entries()].map(([emoji, summary]) => ({ emoji, ...summary }));
}

export class MessagePresenter {
  public constructor(private readonly messagesService: MessagesService) {}

  public async presentMessages(messages: readonly MessageRecord[], viewerId: string): Promise<readonly MessageDto[]> {
    if (messages.length === 0) return [];
    const { userDirectory, storeAccess, messages: messageStore } = this.messagesService.dependencies;
    const senderIds = [...new Set(messages.map((message) => message.senderId).filter((senderId) => senderId !== SYSTEM_SENDER_ID))];
    const storeIds = [...new Set(messages.map((message) => message.senderStoreId).filter((storeId): storeId is string => storeId !== null))];
    const [senders, stores, reactions] = await Promise.all([
      userDirectory.findUserSummaries(senderIds),
      storeIds.length === 0 ? Promise.resolve([]) : storeAccess.findStoreSummaries(storeIds),
      messageStore.listReactions(messages.map((message) => message.id)),
    ]);
    const sendersById = new Map<string, UserSummary>(senders.map((sender) => [sender.id, sender]));
    const storesById = new Map(stores.map((store) => [store.id, convertStoreToIdentity(store)]));
    return messages.map((message) =>
      this.convertMessage(
        message,
        sendersById.get(message.senderId) ?? null,
        message.senderStoreId === null ? null : (storesById.get(message.senderStoreId) ?? null),
        summarizeReactions(reactions.filter((reaction) => reaction.messageId === message.id), viewerId),
      ),
    );
  }

  public convertMessage(message: MessageRecord, sender: UserSummary | null, senderStore: StoreIdentityDto | null, reactions: readonly MessageReactionSummaryDto[]): MessageDto {
    const voiceNote = message.kind === "voice" && message.voiceMediaId !== null
      ? {
          id: message.voiceMediaId,
          type: "voice" as const,
          url: this.messagesService.buildVoiceNoteUrl(message.conversationId, message.id),
          ...(message.voiceDurationSeconds === null ? {} : { durationSeconds: message.voiceDurationSeconds }),
        }
      : null;
    const [firstAttachment] = message.media;
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
      kind: message.kind,
      sender,
      senderStore,
      media: voiceNote ?? (firstAttachment === undefined ? null : { id: message.id, type: firstAttachment.type, url: firstAttachment.url }),
      attachments: message.media,
      reactions,
      expiresAt: message.expiresAt?.toISOString() ?? null,
    };
  }
}
