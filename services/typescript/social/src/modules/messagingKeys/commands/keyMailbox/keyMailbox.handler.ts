import { forbidden, notFound, unprocessable } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { conversationRepository } from "../../../conversations/repositories/conversation.repository.js";
import { resolveEncryptionRecipients } from "../../../conversations/services/encryptionRecipients.service.js";
import { deviceKeyRepository } from "../../repositories/deviceKey.repository.js";
import { keyMailboxRepository, mailboxRetentionMilliseconds, maximumMailboxEntriesPerDevice } from "../../repositories/keyMailbox.repository.js";

export interface MailboxEntryView {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly senderDeviceId: string;
  readonly ciphertext: string;
  readonly createdAt: string;
}

interface DepositCommand {
  readonly senderId: string;
  readonly senderDeviceId: string;
  readonly conversationId: string;
  readonly entries: readonly { readonly userId: string; readonly deviceId: string; readonly ciphertext: string }[];
}

export function createDepositMailboxHandler(context: HandlerContext): Handler<DepositCommand, { readonly accepted: number }> {
  return async (command) => {
    const db = context.database.client;
    if ((await deviceKeyRepository.find(db, command.senderId, command.senderDeviceId)) === null) throw forbidden("DEVICE_NOT_REGISTERED", "This device is not registered for secure chat.");
    const conversation = await conversationRepository.findById(db, command.conversationId);
    if (conversation === null) throw notFound("CONVERSATION_NOT_FOUND", "Conversation not found.");
    const memberIds = new Set([...conversation.members.map((member) => member.accountId), ...(await resolveEncryptionRecipients(context, conversation)).userIds]);
    if (!memberIds.has(command.senderId)) throw notFound("CONVERSATION_NOT_FOUND", "Conversation not found.");
    const rows = [];
    for (const entry of command.entries) {
      if (!memberIds.has(entry.userId)) throw unprocessable("RECIPIENT_NOT_A_MEMBER", "Keys can only be sent to people in this chat.");
      if ((await deviceKeyRepository.find(db, entry.userId, entry.deviceId)) === null) continue;
      if ((await keyMailboxRepository.countForDevice(db, entry.userId, entry.deviceId)) >= maximumMailboxEntriesPerDevice) continue;
      rows.push({ recipientAccountId: entry.userId, recipientDeviceId: entry.deviceId, senderAccountId: command.senderId, senderDeviceId: command.senderDeviceId, conversationId: conversation.id, ciphertext: entry.ciphertext });
    }
    if (rows.length > 0) await keyMailboxRepository.createMany(db, rows);
    return { accepted: rows.length };
  };
}

export function createReadMailboxHandler(context: HandlerContext): Handler<{ readonly accountId: string; readonly deviceId: string }, { readonly data: MailboxEntryView[] }> {
  return async ({ accountId, deviceId }) => {
    const db = context.database.client;
    if ((await deviceKeyRepository.find(db, accountId, deviceId)) === null) throw notFound("DEVICE_NOT_FOUND", "This device is not registered for secure chat.");
    const cutoff = new Date(context.clock.now().getTime() - mailboxRetentionMilliseconds);
    await keyMailboxRepository.deleteExpiredForDevice(db, accountId, deviceId, cutoff);
    const rows = await keyMailboxRepository.listForDevice(db, accountId, deviceId, cutoff);
    return {
      data: rows.map((row) => ({ id: row.id, conversationId: row.conversationId, senderId: row.senderAccountId, senderDeviceId: row.senderDeviceId, ciphertext: row.ciphertext, createdAt: row.createdAt.toISOString() })),
    };
  };
}

export function createAcknowledgeMailboxHandler(context: HandlerContext): Handler<{ readonly accountId: string; readonly deviceId: string; readonly ids: readonly string[] }, { readonly removed: number }> {
  return async ({ accountId, deviceId, ids }) => ({ removed: (await keyMailboxRepository.deleteForDevice(context.database.client, accountId, deviceId, ids)).count });
}
