import type { Db } from "../../../types/database.type.js";

export const reportIntakeRepository = {
  countSince: (db: Db, reporterId: string, since: Date) => db.reportIntake.count({ where: { reporterId, createdAt: { gte: since } } }),
  create: (db: Db, data: { reporterId: string; targetType: string; targetId: string; reason: string; priority: string; evidenceHash: string | null }) => db.reportIntake.create({ data }),
};
