import type { Db } from "../../../types/database.type.js";

export const saveCollectionRepository = {
  create: (db: Db, userId: string, name: string) => db.saveCollection.create({ data: { userId, name } }),
  listByUser: (db: Db, userId: string) => db.saveCollection.findMany({ where: { userId }, orderBy: { id: "asc" } }),
  findOwned: (db: Db, userId: string, id: string) => db.saveCollection.findFirst({ where: { id, userId } }),
};
