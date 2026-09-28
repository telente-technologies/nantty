import { randomUUID } from "node:crypto";

import { ConflictError } from "@zudojs/errors";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import {
  DEFAULT_USER_SETTINGS,
  type NewUserInput,
  type ProfileChanges,
  type UserRecord,
  type UserSettings,
  type UserStatus,
} from "../models/users.model.js";

export interface UsersRepository {
  findById(id: string): Promise<UserRecord | undefined>;
  findManyByIds(ids: readonly string[]): Promise<readonly UserRecord[]>;
  findByEmail(email: string): Promise<UserRecord | undefined>;
  findByPhone(phone: string): Promise<UserRecord | undefined>;
  findByUsername(username: string): Promise<UserRecord | undefined>;
  create(input: NewUserInput): Promise<UserRecord>;
  updateProfile(id: string, changes: ProfileChanges): Promise<UserRecord | undefined>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  markContactVerified(id: string, contact: "email" | "phone", verifiedAt: Date): Promise<void>;
  updateSettings(id: string, settings: UserSettings): Promise<UserRecord | undefined>;
  updateStatus(id: string, status: UserStatus): Promise<void>;
  addRole(id: string, role: string): Promise<void>;
  searchByNameOrUsername(term: string, page: PageRequest): Promise<Page<UserRecord>>;
}

export class InMemoryUsersRepository implements UsersRepository {
  private readonly users = new Map<string, UserRecord>();

  public async findById(id: string): Promise<UserRecord | undefined> {
    return this.users.get(id);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly UserRecord[]> {
    return ids.map((id) => this.users.get(id)).filter((user): user is UserRecord => user !== undefined);
  }

  public async findByEmail(email: string): Promise<UserRecord | undefined> {
    return [...this.users.values()].find((user) => user.email === email);
  }

  public async findByPhone(phone: string): Promise<UserRecord | undefined> {
    return [...this.users.values()].find((user) => user.phone === phone);
  }

  public async findByUsername(username: string): Promise<UserRecord | undefined> {
    return [...this.users.values()].find((user) => user.username === username);
  }

  public async create(input: NewUserInput): Promise<UserRecord> {
    this.assertUnique(input.email, input.phone, input.username, undefined);
    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      email: input.email,
      phone: input.phone,
      username: input.username,
      passwordHash: input.passwordHash,
      name: input.name,
      bio: "",
      avatarUrl: null,
      bannerUrl: null,
      birthday: input.birthday,
      roles: [...input.roles],
      status: "active",
      emailVerifiedAt: input.emailVerifiedAt ?? null,
      phoneVerifiedAt: null,
      settings: DEFAULT_USER_SETTINGS,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  public async updateProfile(id: string, changes: ProfileChanges): Promise<UserRecord | undefined> {
    if (changes.username !== undefined) this.assertUnique(null, null, changes.username, id);
    return this.patch(id, { ...changes });
  }

  public async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    this.patch(id, { passwordHash });
  }

  public async markContactVerified(id: string, contact: "email" | "phone", verifiedAt: Date): Promise<void> {
    this.patch(id, contact === "email" ? { emailVerifiedAt: verifiedAt } : { phoneVerifiedAt: verifiedAt });
  }

  public async updateSettings(id: string, settings: UserSettings): Promise<UserRecord | undefined> {
    return this.patch(id, { settings });
  }

  public async updateStatus(id: string, status: UserStatus): Promise<void> {
    this.patch(id, { status });
  }

  public async addRole(id: string, role: string): Promise<void> {
    const user = this.users.get(id);
    if (user !== undefined && !user.roles.includes(role)) this.patch(id, { roles: [...user.roles, role] });
  }

  public async searchByNameOrUsername(term: string, page: PageRequest): Promise<Page<UserRecord>> {
    const needle = term.toLowerCase();
    const matches = [...this.users.values()]
      .filter((user) => user.status === "active")
      .filter((user) => user.username.toLowerCase().includes(needle) || user.name.toLowerCase().includes(needle))
      .sort(compareByNewestFirst);
    return paginateSortedItems(matches, page);
  }

  private patch(id: string, changes: Partial<UserRecord>): UserRecord | undefined {
    const user = this.users.get(id);
    if (user === undefined) return undefined;
    const updated: UserRecord = { ...user, ...changes, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  private assertUnique(email: string | null, phone: string | null, username: string, exceptId: string | undefined): void {
    for (const user of this.users.values()) {
      if (user.id === exceptId) continue;
      if (user.username === username) throw new ConflictError("This username is taken.");
      if ((email !== null && user.email === email) || (phone !== null && user.phone === phone)) {
        throw new ConflictError("An account cannot be created with these details.");
      }
    }
  }
}
