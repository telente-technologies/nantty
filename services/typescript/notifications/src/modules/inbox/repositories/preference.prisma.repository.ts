import type { PrismaClient } from "../../../databases/prisma.database.js";
import type { PreferenceRepository, PreferenceRow } from "../../../interfaces/repositories.interface.js";

export class PreferencePrismaRepository implements PreferenceRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async list(userId: string): Promise<readonly PreferenceRow[]> {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
    return rows.map((row) => ({ category: row.category, push: row.push, email: row.email }));
  }

  public async upsert(userId: string, category: string, changes: { readonly push?: boolean; readonly email?: boolean }): Promise<PreferenceRow> {
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId_category: { userId, category } },
      create: { userId, category, ...changes },
      update: changes,
    });
    return { category: row.category, push: row.push, email: row.email };
  }
}
