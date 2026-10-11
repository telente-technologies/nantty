import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { MentionEntity } from "../../mentions/models/mention.model.js";
import type { MessageKindName, MessageView } from "../models/message.model.js";
import type { MessageRow } from "../repositories/message.repository.js";
import { signChatMediaUrls } from "./chatMediaOwnership.service.js";

export interface MessageViewOptions {
  readonly peerLastReadAt: Date | null;
  readonly isDirect: boolean;
}

export async function buildMessageViews(context: HandlerContext, viewerId: string, rows: readonly MessageRow[], options: MessageViewOptions): Promise<MessageView[]> {
  const senders = await context.directory.findUserSummaries(rows.map((row) => row.senderId));
  const signedUrls = await signChatMediaUrls(context.chatMedia, viewerId, rows.flatMap((row) => (row.mediaId === null || row.mediaPurgedAt !== null || row.hiddenAt !== null ? [] : [row.mediaId])));
  return rows.map((row) => {
    const hidden = row.hiddenAt !== null;
    const purged = row.mediaPurgedAt !== null || hidden;
    const mediaUrl = row.mediaId === null || purged ? null : (signedUrls.get(row.mediaId) ?? null);
    const sender = senders.get(row.senderId);
    return {
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      text: "",
      createdAt: row.createdAt.toISOString(),
      kind: row.kind as MessageKindName,
      ...(sender === undefined ? {} : { sender }),
      media: row.mediaId === null || row.mediaType === null ? null : { id: row.mediaId, type: row.mediaType as "voice" | "image" | "video", url: mediaUrl, ...(row.mediaDurationSeconds === null ? {} : { durationSeconds: row.mediaDurationSeconds }) },
      expiresAt: row.expiresAt?.toISOString() ?? null,
      mediaExpiresAt: row.mediaExpiresAt?.toISOString() ?? null,
      linkPreview: hidden ? null : row.linkPreviewEnvelope,
      document: row.kind !== "document" || hidden ? null : { url: mediaUrl },
      readAt: options.isDirect && row.senderId === viewerId && options.peerLastReadAt !== null && options.peerLastReadAt >= row.createdAt ? options.peerLastReadAt.toISOString() : null,
      moderationHidden: hidden,
      encryption: hidden || row.ciphertext === null ? null : { deviceId: row.deviceId ?? "", ciphertext: row.ciphertext, protocol: row.protocol },
      mentions: row.mentions as unknown as MentionEntity[],
      clientMessageId: row.clientMessageId,
    };
  });
}
