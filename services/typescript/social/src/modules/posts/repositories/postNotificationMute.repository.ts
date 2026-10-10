import type { Db } from "../../../types/database.type.js";

export const postNotificationMuteRepository = {
  mute: (db: Db, userId: string, postId: string) => db.postNotificationMute.createMany({ data: [{ userId, postId }], skipDuplicates: true }),

  unmute: (db: Db, userId: string, postId: string) => db.postNotificationMute.deleteMany({ where: { userId, postId } }),

  isMuted: async (db: Db, userId: string, postId: string): Promise<boolean> => (await db.postNotificationMute.count({ where: { userId, postId } })) > 0,

  mutedPostIds: async (db: Db, userId: string, postIds: readonly string[]): Promise<Set<string>> =>
    postIds.length === 0 ? new Set() : new Set((await db.postNotificationMute.findMany({ where: { userId, postId: { in: [...postIds] } }, select: { postId: true } })).map((row) => row.postId)),
};
