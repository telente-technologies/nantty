import { randomUUID } from "node:crypto";

import type { AdAccountInviteRecord, AdActivityRecord, InviteStatus, NewAdActivityInput } from "../models/adAccounts.model.js";

export type NewAdInviteInput = Omit<AdAccountInviteRecord, "id" | "status">;

export interface AdInvitesRepository {
  createInvite(input: NewAdInviteInput): Promise<AdAccountInviteRecord>;
  findInviteById(inviteId: string): Promise<AdAccountInviteRecord | undefined>;
  findInviteByTokenHash(tokenHash: string): Promise<AdAccountInviteRecord | undefined>;
  listInvites(accountId: string, status: InviteStatus): Promise<readonly AdAccountInviteRecord[]>;
  changeInviteStatus(inviteId: string, status: InviteStatus): Promise<void>;
  recordActivity(input: NewAdActivityInput): Promise<AdActivityRecord>;
  listActivity(accountId: string, objectType: string | undefined): Promise<readonly AdActivityRecord[]>;
}

export class InMemoryAdInvitesRepository implements AdInvitesRepository {
  private readonly invites = new Map<string, AdAccountInviteRecord>();
  private readonly activity: AdActivityRecord[] = [];

  public async createInvite(input: NewAdInviteInput): Promise<AdAccountInviteRecord> {
    const invite: AdAccountInviteRecord = { ...input, id: randomUUID(), status: "pending" };
    this.invites.set(invite.id, invite);
    return invite;
  }

  public async findInviteById(inviteId: string): Promise<AdAccountInviteRecord | undefined> {
    return this.invites.get(inviteId);
  }

  public async findInviteByTokenHash(tokenHash: string): Promise<AdAccountInviteRecord | undefined> {
    return [...this.invites.values()].find((invite) => invite.tokenHash === tokenHash);
  }

  public async listInvites(accountId: string, status: InviteStatus): Promise<readonly AdAccountInviteRecord[]> {
    return [...this.invites.values()].filter((invite) => invite.accountId === accountId && invite.status === status);
  }

  public async changeInviteStatus(inviteId: string, status: InviteStatus): Promise<void> {
    const invite = this.invites.get(inviteId);
    if (invite !== undefined) this.invites.set(inviteId, { ...invite, status });
  }

  public async recordActivity(input: NewAdActivityInput): Promise<AdActivityRecord> {
    const entry = { ...input, id: randomUUID() };
    this.activity.push(entry);
    return entry;
  }

  public async listActivity(accountId: string, objectType: string | undefined): Promise<readonly AdActivityRecord[]> {
    return this.activity
      .filter((entry) => entry.accountId === accountId && (objectType === undefined || entry.objectType === objectType))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id));
  }
}
