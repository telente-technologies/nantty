import type { Db } from "../../../types/database.type.js";
import type { StreakSnapshot } from "../services/streakEngine.service.js";

export const streakRepository = {
  find: (db: Db, conversationId: string) => db.chatStreak.findUnique({ where: { conversationId } }),

  save: (db: Db, conversationId: string, snapshot: StreakSnapshot) =>
    db.chatStreak.upsert({
      where: { conversationId },
      create: { conversationId, ...snapshot },
      update: { ...snapshot },
    }),

  recordSenderDay: async (db: Db, conversationId: string, accountId: string, localDay: string): Promise<void> => {
    await db.chatStreak.createMany({ data: [{ conversationId }], skipDuplicates: true });
    await db.streakSenderDay.createMany({ data: [{ conversationId, accountId, localDay }], skipDuplicates: true });
  },

  sentOnDay: async (db: Db, conversationId: string, accountId: string, localDay: string): Promise<boolean> =>
    (await db.streakSenderDay.findUnique({ where: { conversationId_accountId_localDay: { conversationId, accountId, localDay } } })) !== null,

  restoresUsedInMonth: (db: Db, accountId: string, monthKey: string) => db.streakRestore.count({ where: { accountId, monthKey } }),

  recordRestore: (db: Db, conversationId: string, accountId: string, monthKey: string, restoredCount: number) =>
    db.streakRestore.create({ data: { conversationId, accountId, monthKey, restoredCount } }),

  addCelebrations: (db: Db, conversationId: string, accountIds: readonly string[], days: number) =>
    db.streakCelebration.createMany({ data: accountIds.map((accountId) => ({ conversationId, accountId, days })) }),

  pendingCelebration: (db: Db, conversationId: string, accountId: string) =>
    db.streakCelebration.findFirst({ where: { conversationId, accountId, celebratedAt: null }, orderBy: { id: "asc" } }),

  markCelebrated: (db: Db, conversationId: string, accountId: string, at: Date) =>
    db.streakCelebration.updateMany({ where: { conversationId, accountId, celebratedAt: null }, data: { celebratedAt: at } }),
};
