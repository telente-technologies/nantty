import { ConflictError } from "@zudojs/errors";

import type { ReservedUsernameMatchKind } from "../../../constants/reservedUsernames.constant.js";
import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { ReservedUsername, UsernameChange, UsernameHold } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type {
  NewReservedUsernameInput,
  NewUsernameChangeInput,
  ReservedUsernameRecord,
  UsernameChangeReason,
  UsernameChangeRecord,
  UsernameHoldKind,
  UsernameHoldRecord,
} from "../models/usernames.model.js";
import type { UsernamesRepository } from "./usernames.repository.js";

function convertChangeRow(row: UsernameChange): UsernameChangeRecord {
  return { ...row, reason: row.reason as UsernameChangeReason };
}

function convertHoldRow(row: UsernameHold): UsernameHoldRecord {
  return { ...row, kind: row.kind as UsernameHoldKind };
}

function convertReservedRow(row: ReservedUsername): ReservedUsernameRecord {
  return { ...row, matchKind: row.matchKind as ReservedUsernameMatchKind };
}

export class PrismaUsernamesRepository implements UsernamesRepository {
  public async recordChange(input: NewUsernameChangeInput): Promise<UsernameChangeRecord> {
    return convertChangeRow(await prisma().usernameChange.create({ data: { ...input } }));
  }

  public async listChangesForUser(userId: string): Promise<readonly UsernameChangeRecord[]> {
    const rows = await prisma().usernameChange.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });
    return rows.map(convertChangeRow);
  }

  public async findHold(username: string): Promise<UsernameHoldRecord | undefined> {
    const row = await prisma().usernameHold.findUnique({ where: { username } });
    return row === null ? undefined : convertHoldRow(row);
  }

  public async saveHold(hold: UsernameHoldRecord): Promise<void> {
    await prisma().usernameHold.upsert({ where: { username: hold.username }, create: { ...hold }, update: { ...hold } });
  }

  public async removeHold(username: string): Promise<boolean> {
    const result = await prisma().usernameHold.deleteMany({ where: { username } });
    return result.count === 1;
  }

  public async listHolds(kind: UsernameHoldKind): Promise<readonly UsernameHoldRecord[]> {
    const rows = await prisma().usernameHold.findMany({ where: { kind }, orderBy: { createdAt: "desc" }, take: 500 });
    return rows.map(convertHoldRow);
  }

  public async listReservedUsernames(): Promise<readonly ReservedUsernameRecord[]> {
    const rows = await prisma().reservedUsername.findMany({ orderBy: { term: "asc" } });
    return rows.map(convertReservedRow);
  }

  public async addReservedUsername(input: NewReservedUsernameInput, now: Date): Promise<ReservedUsernameRecord> {
    try {
      return convertReservedRow(await prisma().reservedUsername.create({ data: { ...input, createdAt: now } }));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new ConflictError("This term is already reserved.");
      throw error;
    }
  }

  public async removeReservedUsername(id: string): Promise<ReservedUsernameRecord | undefined> {
    const row = await prisma().reservedUsername.findUnique({ where: { id } });
    if (row === null) return undefined;
    await prisma().reservedUsername.deleteMany({ where: { id } });
    return convertReservedRow(row);
  }
}
