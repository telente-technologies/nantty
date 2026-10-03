import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { MentionEntity } from "../../mentions/models/mention.model.js";
import type { MessageDocument, MessageKindName, MessagePollView, MessageReactionSummary, MessageView, SharedContentReference, SharedLocation } from "../models/message.model.js";
import type { MessageRow } from "../repositories/message.repository.js";
import { buildSharedContentCard } from "./sharedContentCard.service.js";

export interface MessageViewOptions {
  readonly peerLastReadAt: Date | null;
  readonly isDirect: boolean;
}

export function summariseMessageReactions(row: MessageRow, viewerId: string): MessageReactionSummary[] {
  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const reaction of row.reactions) {
    const entry = byEmoji.get(reaction.emoji) ?? { count: 0, mine: false };
    byEmoji.set(reaction.emoji, { count: entry.count + 1, mine: entry.mine || reaction.userId === viewerId });
  }
  return [...byEmoji].map(([emoji, entry]) => ({ emoji, count: entry.count, reactedByMe: entry.mine }));
}

export function buildPollView(row: MessageRow): MessagePollView | null {
  if (row.pollQuestion === null) return null;
  return { question: row.pollQuestion, allowMultipleAnswers: row.pollAllowMultiple, options: row.pollOptions.map((option) => ({ id: option.id, text: option.text, voteCount: option._count.votes, votedByMe: option.votes.length > 0 })) };
}

export async function buildMessageViews(context: HandlerContext, viewerId: string, rows: readonly MessageRow[], options: MessageViewOptions): Promise<MessageView[]> {
  const senders = await context.directory.findUserSummaries(rows.map((row) => row.senderId));
  const views: MessageView[] = [];
  for (const row of rows) {
    const purged = row.mediaPurgedAt !== null;
    const document = row.document as MessageDocument | null;
    const sharedReference = row.sharedContent as SharedContentReference | null;
    const sender = senders.get(row.senderId);
    views.push({
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      text: "",
      createdAt: row.createdAt.toISOString(),
      kind: row.kind as MessageKindName,
      ...(sender === undefined ? {} : { sender }),
      media: row.mediaId === null || row.mediaType === null ? null : { id: row.mediaId, type: row.mediaType as "voice" | "image" | "video", url: purged ? null : row.mediaUrl, ...(row.mediaDurationSeconds === null ? {} : { durationSeconds: row.mediaDurationSeconds }) },
      reactions: summariseMessageReactions(row, viewerId),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      mediaExpiresAt: row.mediaExpiresAt?.toISOString() ?? null,
      linkPreview: row.linkPreviewEnvelope,
      sharedContent: sharedReference === null ? null : await buildSharedContentCard(context, viewerId, sharedReference),
      location: row.location as SharedLocation | null,
      document: document === null ? null : purged ? { ...document, url: null } : document,
      poll: buildPollView(row),
      readAt: options.isDirect && row.senderId === viewerId && options.peerLastReadAt !== null && options.peerLastReadAt >= row.createdAt ? options.peerLastReadAt.toISOString() : null,
      encryption: row.deviceId === null && row.ciphertext === null ? null : { deviceId: row.deviceId ?? "", ciphertext: row.ciphertext, protocol: row.protocol },
      mentions: row.mentions as unknown as MentionEntity[],
      clientMessageId: row.clientMessageId,
    });
  }
  return views;
}
