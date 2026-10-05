import type { Db } from "../../../types/database.type.js";

export const downloadSettingRepository = {
  findSetting: (db: Db, accountId: string) => db.downloadSetting.findUnique({ where: { accountId } }),

  upsertSetting: (db: Db, accountId: string, allowDownloads: boolean) =>
    db.downloadSetting.upsert({ where: { accountId }, create: { accountId, allowDownloads }, update: { allowDownloads } }),

  accountIdsWithDownloadsOff: async (db: Db, accountIds: readonly string[]): Promise<ReadonlySet<string>> =>
    accountIds.length === 0
      ? new Set()
      : new Set((await db.downloadSetting.findMany({ where: { accountId: { in: [...accountIds] }, allowDownloads: false }, select: { accountId: true } })).map((row) => row.accountId)),
};
