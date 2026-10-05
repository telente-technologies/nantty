import * as Crypto from "expo-crypto";

import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import type { ChatReportEvidenceAttachment, ChatReportEvidenceMessage } from "@/types";

const isReportableMessage = (message: LocallyStoredMessage) => message.deliveryStatus === "sent" && message.kind !== "system" && !message.decryptionNotice;

export const listReportableMessagesOldestFirst = (messages: readonly LocallyStoredMessage[]) => messages.filter(isReportableMessage);

export const pickLastReportableMessages = (messages: readonly LocallyStoredMessage[], count: number) =>
  listReportableMessagesOldestFirst(messages).slice(-count);

const describeAttachments = (message: LocallyStoredMessage): ChatReportEvidenceAttachment[] => {
  const empty = { mimeType: null, fileName: null, sizeBytes: null, durationSeconds: null };
  if (message.media) return [{ ...empty, type: message.media.type, durationSeconds: message.media.durationSeconds ?? null }];
  if (message.document) {
    return [{ ...empty, type: "document", mimeType: message.document.mimeType, fileName: message.document.fileName, sizeBytes: message.document.sizeBytes }];
  }
  if (message.location) return [{ ...empty, type: "location" }];
  if (message.poll) return [{ ...empty, type: "poll" }];
  if (message.sharedContent) return [{ ...empty, type: "shared" }];
  return [];
};

export const buildEvidenceMessage = (message: LocallyStoredMessage, myUserId: string, senderNameById: ReadonlyMap<string, string>): ChatReportEvidenceMessage => ({
  messageId: message.id,
  senderId: message.senderId === "u_me" ? myUserId : message.senderId,
  senderName: senderNameById.get(message.senderId) ?? message.sender?.name ?? "Unknown",
  sentAt: message.createdAt,
  text: message.poll ? message.poll.question : message.text,
  attachments: describeAttachments(message),
});

export const hashEvidenceForIntegrity = (evidence: readonly ChatReportEvidenceMessage[]) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(evidence));
