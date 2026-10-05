import type { Db } from "../../../types/database.type.js";

export const maximumMailboxEntriesPerDeposit = 100;
export const maximumMailboxEntriesPerDevice = 2000;
export const maximumMailboxCiphertextLength = 4096;
export const mailboxPageSize = 200;
export const mailboxRetentionMilliseconds = 30 * 86_400_000;

export interface MailboxEntryRow {
  readonly recipientAccountId: string;
  readonly recipientDeviceId: string;
  readonly senderAccountId: string;
  readonly senderDeviceId: string;
  readonly conversationId: string;
  readonly ciphertext: string;
}

export const keyMailboxRepository = {
  createMany: (db: Db, rows: readonly MailboxEntryRow[]) => db.chatKeyMailboxEntry.createMany({ data: [...rows] }),

  countForDevice: (db: Db, accountId: string, deviceId: string) => db.chatKeyMailboxEntry.count({ where: { recipientAccountId: accountId, recipientDeviceId: deviceId } }),

  listForDevice: (db: Db, accountId: string, deviceId: string, since: Date) =>
    db.chatKeyMailboxEntry.findMany({ where: { recipientAccountId: accountId, recipientDeviceId: deviceId, createdAt: { gte: since } }, orderBy: { id: "asc" }, take: mailboxPageSize }),

  deleteForDevice: (db: Db, accountId: string, deviceId: string, ids: readonly string[]) =>
    db.chatKeyMailboxEntry.deleteMany({ where: { recipientAccountId: accountId, recipientDeviceId: deviceId, id: { in: [...ids] } } }),

  deleteExpiredForDevice: (db: Db, accountId: string, deviceId: string, before: Date) =>
    db.chatKeyMailboxEntry.deleteMany({ where: { recipientAccountId: accountId, recipientDeviceId: deviceId, createdAt: { lt: before } } }),
};
