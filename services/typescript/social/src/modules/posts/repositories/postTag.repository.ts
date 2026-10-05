import type { Db } from "../../../types/database.type.js";

const tagOrder = [{ createdAt: "asc" }, { taggedUserId: "asc" }] as const;

export const postTagRepository = {
  forPosts: (db: Db, postIds: readonly string[]) => db.postTag.findMany({ where: { postId: { in: [...postIds] } }, orderBy: [...tagOrder], select: { postId: true, taggedUserId: true } }),

  userIdsFor: async (db: Db, postId: string): Promise<string[]> => (await db.postTag.findMany({ where: { postId }, select: { taggedUserId: true } })).map((row) => row.taggedUserId),

  page: (db: Db, postId: string, limit: number, cursorUserId: string | undefined) =>
    db.postTag.findMany({
      where: { postId },
      orderBy: [...tagOrder],
      take: limit + 1,
      ...(cursorUserId === undefined ? {} : { cursor: { postId_taggedUserId: { postId, taggedUserId: cursorUserId } }, skip: 1 }),
    }),

  addMany: (db: Db, postId: string, taggedByUserId: string, taggedUserIds: readonly string[]) =>
    db.postTag.createMany({ data: taggedUserIds.map((taggedUserId) => ({ postId, taggedUserId, taggedByUserId })), skipDuplicates: true }),

  removeMany: (db: Db, postId: string, taggedUserIds: readonly string[]) => db.postTag.deleteMany({ where: { postId, taggedUserId: { in: [...taggedUserIds] } } }),

  removeOne: async (db: Db, postId: string, taggedUserId: string): Promise<boolean> => (await db.postTag.deleteMany({ where: { postId, taggedUserId } })).count === 1,

  taggingDisabledAmong: async (db: Db, accountIds: readonly string[]) =>
    new Set((await db.taggingSetting.findMany({ where: { accountId: { in: [...accountIds] }, allowTagging: false }, select: { accountId: true } })).map((row) => row.accountId)),

  findSetting: (db: Db, accountId: string) => db.taggingSetting.findUnique({ where: { accountId } }),

  upsertSetting: (db: Db, accountId: string, allowTagging: boolean) =>
    db.taggingSetting.upsert({ where: { accountId }, create: { accountId, allowTagging }, update: { allowTagging } }),
};
