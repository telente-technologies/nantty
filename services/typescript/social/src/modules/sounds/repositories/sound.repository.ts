import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";

export const soundRepository = {
  create: (db: Db, data: Prisma.SoundUncheckedCreateInput) => db.sound.create({ data }),
  findById: (db: Db, id: string) => db.sound.findUnique({ where: { id } }),
  update: (db: Db, id: string, data: Prisma.SoundUncheckedUpdateInput) => db.sound.update({ where: { id }, data }),
  incrementUsage: (db: Db, id: string, by: number) => db.sound.update({ where: { id }, data: { usageCount: { increment: by } } }),

  pageSearch: (db: Db, term: string, limit: number, cursor: string | undefined) =>
    db.sound.findMany({
      where: { status: "available", ...(term === "" ? {} : { title: { contains: term, mode: "insensitive" } }) },
      orderBy: { id: "desc" }, take: limit + 1, ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    }),

  trending: (db: Db, limit: number) => db.sound.findMany({ where: { status: "available" }, orderBy: [{ usageCount: "desc" }, { id: "desc" }], take: limit }),

  pageSaved: async (db: Db, userId: string, limit: number, cursor: string | undefined) => {
    const saves = await db.soundSave.findMany({
      where: { userId, sound: { status: "available" } }, orderBy: [{ createdAt: "desc" }, { soundId: "desc" }], take: limit + 1, include: { sound: true },
      ...(cursor === undefined ? {} : { cursor: { soundId_userId: { soundId: cursor, userId } }, skip: 1 }),
    });
    return saves.map((save) => ({ ...save.sound, id: save.soundId }));
  },

  savedIds: async (db: Db, userId: string, soundIds: readonly string[]) =>
    new Set((await db.soundSave.findMany({ where: { userId, soundId: { in: [...soundIds] } }, select: { soundId: true } })).map((row) => row.soundId)),
  addSave: (db: Db, soundId: string, userId: string) => db.soundSave.createMany({ data: [{ soundId, userId }], skipDuplicates: true }),
  removeSave: (db: Db, soundId: string, userId: string) => db.soundSave.deleteMany({ where: { soundId, userId } }),
};
