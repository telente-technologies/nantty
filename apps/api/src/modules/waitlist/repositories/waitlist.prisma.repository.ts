import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { WaitlistEntry } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { NewWaitlistEntry, WaitlistEntryRecord } from "../models/waitlist.model.js";
import type { WaitlistRepository } from "./waitlist.repository.js";

function convertWaitlistRowToRecord(row: WaitlistEntry): WaitlistEntryRecord {
  return { ...row, role: row.role === "seller" ? "seller" : "buyer" };
}

export class PrismaWaitlistRepository implements WaitlistRepository {
  public async addEntryIfEmailIsNew(entry: NewWaitlistEntry, createdAt: Date): Promise<boolean> {
    try {
      await prisma().waitlistEntry.create({ data: { ...entry, createdAt } });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  public async list(page: PageRequest): Promise<Page<WaitlistEntryRecord>> {
    const rows = await prisma().waitlistEntry.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertWaitlistRowToRecord);
  }

  public countEntries(): Promise<number> {
    return prisma().waitlistEntry.count();
  }
}
