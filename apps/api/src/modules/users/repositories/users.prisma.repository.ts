import { ConflictError } from "@zudojs/errors";

import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { User } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import {
  parseUserSettings,
  type NewUserInput,
  type ProfileChanges,
  type UserRecord,
  type UserSettings,
  type UserStatus,
} from "../models/users.model.js";
import type { UsersRepository } from "./users.repository.js";

function convertUserRowToRecord(row: User): UserRecord {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    username: row.username,
    passwordHash: row.passwordHash,
    name: row.name,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    bannerUrl: row.bannerUrl,
    birthday: row.birthday,
    roles: row.roles,
    status: row.status === "deactivated" ? "deactivated" : "active",
    emailVerifiedAt: row.emailVerifiedAt,
    phoneVerifiedAt: row.phoneVerifiedAt,
    settings: parseUserSettings(row.settings),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function convertUniqueViolationToConflict(error: unknown): never {
  if (!isUniqueConstraintViolation(error)) throw error;
  const target = JSON.stringify((error as { meta?: unknown }).meta ?? "");
  throw new ConflictError(
    target.includes("username") ? "This username is taken." : "An account cannot be created with these details.",
  );
}

export class PrismaUsersRepository implements UsersRepository {
  public async findById(id: string): Promise<UserRecord | undefined> {
    const row = await prisma().user.findUnique({ where: { id } });
    return row === null ? undefined : convertUserRowToRecord(row);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly UserRecord[]> {
    const rows = await prisma().user.findMany({ where: { id: { in: [...ids] } } });
    return rows.map(convertUserRowToRecord);
  }

  public async findByEmail(email: string): Promise<UserRecord | undefined> {
    const row = await prisma().user.findUnique({ where: { email } });
    return row === null ? undefined : convertUserRowToRecord(row);
  }

  public async findByPhone(phone: string): Promise<UserRecord | undefined> {
    const row = await prisma().user.findUnique({ where: { phone } });
    return row === null ? undefined : convertUserRowToRecord(row);
  }

  public async findByUsername(username: string): Promise<UserRecord | undefined> {
    const row = await prisma().user.findUnique({ where: { username } });
    return row === null ? undefined : convertUserRowToRecord(row);
  }

  public async create(input: NewUserInput): Promise<UserRecord> {
    try {
      const row = await prisma().user.create({
        data: {
          email: input.email,
          phone: input.phone,
          username: input.username,
          passwordHash: input.passwordHash,
          name: input.name,
          birthday: input.birthday,
          roles: [...input.roles],
          emailVerifiedAt: input.emailVerifiedAt ?? null,
        },
      });
      return convertUserRowToRecord(row);
    } catch (error) {
      return convertUniqueViolationToConflict(error);
    }
  }

  public async updateProfile(id: string, changes: ProfileChanges): Promise<UserRecord | undefined> {
    try {
      const result = await prisma().user.updateMany({ where: { id }, data: { ...changes } });
      return result.count === 0 ? undefined : this.findById(id);
    } catch (error) {
      return convertUniqueViolationToConflict(error);
    }
  }

  public async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await prisma().user.updateMany({ where: { id }, data: { passwordHash } });
  }

  public async markContactVerified(id: string, contact: "email" | "phone", verifiedAt: Date): Promise<void> {
    await prisma().user.updateMany({
      where: { id },
      data: contact === "email" ? { emailVerifiedAt: verifiedAt } : { phoneVerifiedAt: verifiedAt },
    });
  }

  public async updateSettings(id: string, settings: UserSettings): Promise<UserRecord | undefined> {
    const result = await prisma().user.updateMany({ where: { id }, data: { settings: { ...settings } } });
    return result.count === 0 ? undefined : this.findById(id);
  }

  public async updateStatus(id: string, status: UserStatus): Promise<void> {
    await prisma().user.updateMany({ where: { id }, data: { status } });
  }

  public async addRole(id: string, role: string): Promise<void> {
    await prisma().user.updateMany({ where: { id, NOT: { roles: { has: role } } }, data: { roles: { push: role } } });
  }

  public async searchByNameOrUsername(term: string, page: PageRequest): Promise<Page<UserRecord>> {
    const rows = await prisma().user.findMany({
      where: {
        status: "active",
        OR: [
          { username: { contains: term, mode: "insensitive" } },
          { name: { contains: term, mode: "insensitive" } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertUserRowToRecord);
  }
}
