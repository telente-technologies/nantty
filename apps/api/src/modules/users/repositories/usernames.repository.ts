import { randomUUID } from "node:crypto";

import { ConflictError } from "@zudojs/errors";

import type {
  NewReservedUsernameInput,
  NewUsernameChangeInput,
  ReservedUsernameRecord,
  UsernameChangeRecord,
  UsernameHoldRecord,
} from "../models/usernames.model.js";

export interface UsernamesRepository {
  recordChange(input: NewUsernameChangeInput): Promise<UsernameChangeRecord>;
  listChangesForUser(userId: string): Promise<readonly UsernameChangeRecord[]>;
  findHold(username: string): Promise<UsernameHoldRecord | undefined>;
  saveHold(hold: UsernameHoldRecord): Promise<void>;
  removeHold(username: string): Promise<boolean>;
  listHolds(kind: UsernameHoldRecord["kind"]): Promise<readonly UsernameHoldRecord[]>;
  listReservedUsernames(): Promise<readonly ReservedUsernameRecord[]>;
  addReservedUsername(input: NewReservedUsernameInput, now: Date): Promise<ReservedUsernameRecord>;
  removeReservedUsername(id: string): Promise<ReservedUsernameRecord | undefined>;
}

export class InMemoryUsernamesRepository implements UsernamesRepository {
  private readonly changes: UsernameChangeRecord[] = [];
  private readonly holds = new Map<string, UsernameHoldRecord>();
  private readonly reserved = new Map<string, ReservedUsernameRecord>();

  public async recordChange(input: NewUsernameChangeInput): Promise<UsernameChangeRecord> {
    const record: UsernameChangeRecord = { ...input, id: randomUUID() };
    this.changes.push(record);
    return record;
  }

  public async listChangesForUser(userId: string): Promise<readonly UsernameChangeRecord[]> {
    return this.changes.filter((change) => change.userId === userId).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  public async findHold(username: string): Promise<UsernameHoldRecord | undefined> {
    return this.holds.get(username);
  }

  public async saveHold(hold: UsernameHoldRecord): Promise<void> {
    this.holds.set(hold.username, hold);
  }

  public async removeHold(username: string): Promise<boolean> {
    return this.holds.delete(username);
  }

  public async listHolds(kind: UsernameHoldRecord["kind"]): Promise<readonly UsernameHoldRecord[]> {
    return [...this.holds.values()].filter((hold) => hold.kind === kind).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  public async listReservedUsernames(): Promise<readonly ReservedUsernameRecord[]> {
    return [...this.reserved.values()].sort((left, right) => left.term.localeCompare(right.term));
  }

  public async addReservedUsername(input: NewReservedUsernameInput, now: Date): Promise<ReservedUsernameRecord> {
    if ([...this.reserved.values()].some((entry) => entry.term === input.term)) throw new ConflictError("This term is already reserved.");
    const record: ReservedUsernameRecord = { ...input, id: randomUUID(), createdAt: now };
    this.reserved.set(record.id, record);
    return record;
  }

  public async removeReservedUsername(id: string): Promise<ReservedUsernameRecord | undefined> {
    const record = this.reserved.get(id);
    this.reserved.delete(id);
    return record;
  }
}
