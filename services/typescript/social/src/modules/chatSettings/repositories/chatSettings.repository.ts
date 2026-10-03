import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export const chatSettingsRepository = {
  find: (db: Db, accountId: string) => db.chatSettings.findUnique({ where: { accountId } }),

  upsert: (db: Db, accountId: string, data: Prisma.ChatSettingsUncheckedUpdateInput) =>
    db.chatSettings.upsert({ where: { accountId }, create: { ...(data as Prisma.ChatSettingsUncheckedCreateInput), accountId }, update: data }),

  findMany: (db: Db, accountIds: readonly string[]) => db.chatSettings.findMany({ where: { accountId: { in: [...accountIds] } } }),
};
