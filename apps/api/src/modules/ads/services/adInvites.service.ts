import { createHash, randomBytes } from "node:crypto";

import { adsError, adsNotFound, throwIfValidationIssues } from "../../../errors/ads.error.js";
import type { NotificationEmailSender } from "../../notifications/channels/email.channel.js";
import type { AdAccountInviteRecord, AdAccountRole } from "../models/adAccounts.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";
import { paginateAdsItems, type AdAccountAccess } from "./adAccountAccess.service.js";

const INVITE_LIFETIME_MS = 7 * 86_400_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class AdInvitesService {
  public constructor(
    private readonly dependencies: AdsDependencies,
    private readonly access: AdAccountAccess,
    private readonly emailSender: NotificationEmailSender,
    private readonly invitePageBaseUrl: string,
  ) {}

  public async listInvites(userId: string, accountId: string) {
    await this.access.requirePermission(userId, accountId, "account:view");
    const now = this.dependencies.clock.now();
    const invites = (await this.dependencies.invites.listInvites(accountId, "pending")).filter((invite) => invite.expiresAt > now);
    return { items: await Promise.all(invites.map((invite) => this.presentInvite(invite))) };
  }

  public async createInvite(userId: string, accountId: string, email: string, role: AdAccountRole) {
    const { account } = await this.access.requirePermission(userId, accountId, "members:manage");
    const normalized = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254) throwIfValidationIssues([{ path: "email", message: "Enter a valid email address." }]);
    const { invites, accounts, cipher, clock, userDirectory } = this.dependencies;
    const now = clock.now();
    const emailHash = hashValue(normalized);
    const pending = (await invites.listInvites(accountId, "pending")).filter((invite) => invite.expiresAt > now);
    if (pending.some((invite) => invite.emailHash === emailHash)) throwIfValidationIssues([{ path: "email", message: "This person already has a pending invite." }]);
    for (const member of await accounts.listMembers(accountId)) {
      const contact = await userDirectory.findUserContact(member.userId);
      if (contact?.email !== null && contact?.email !== undefined && normalizeEmail(contact.email) === normalized) throwIfValidationIssues([{ path: "email", message: "This person is already a member." }]);
    }
    const token = randomBytes(32).toString("base64url");
    const invite = await invites.createInvite({
      accountId,
      emailHash,
      emailCiphertext: await cipher.encryptText(normalized),
      role,
      invitedById: userId,
      tokenHash: hashValue(token),
      createdAt: now,
      expiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS),
    });
    await this.emailSender.sendNotificationEmail(
      normalized,
      `You're invited to the ${account.name} ad account`,
      `You have been invited to join ${account.name} on Zudomart Ads as ${role}. Accept within 7 days: ${this.invitePageBaseUrl}/invites/${token}`,
    );
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "invite", objectId: invite.id, summary: `Invited a ${role}`, changes: [] });
    return this.presentInvite(invite);
  }

  public async revokeInvite(userId: string, accountId: string, inviteId: string): Promise<void> {
    await this.access.requirePermission(userId, accountId, "members:manage");
    const invite = await this.dependencies.invites.findInviteById(inviteId);
    if (invite === undefined || invite.accountId !== accountId || invite.status !== "pending") throw adsNotFound("Invite");
    await this.dependencies.invites.changeInviteStatus(inviteId, "revoked");
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "invite", objectId: inviteId, summary: "Revoked an invite", changes: [] });
  }

  public async previewInvite(token: string) {
    const invite = await this.findUsableInvite(token);
    const account = await this.dependencies.accounts.findAccountById(invite.accountId);
    const [inviter] = await this.dependencies.userDirectory.findUserSummaries([invite.invitedById]);
    return { accountName: account?.name ?? "", role: invite.role, invitedBy: inviter?.name ?? "", expiresAt: invite.expiresAt.toISOString() };
  }

  public async acceptInvite(userId: string, token: string) {
    const invite = await this.findUsableInvite(token);
    const contact = await this.dependencies.userDirectory.findUserContact(userId);
    if (contact?.email === null || contact?.email === undefined || hashValue(normalizeEmail(contact.email)) !== invite.emailHash) {
      throw adsError(403, "INVITE_EMAIL_MISMATCH", "This invite was sent to a different email address.");
    }
    await this.dependencies.accounts.addMember(invite.accountId, userId, invite.role, this.dependencies.clock.now());
    await this.dependencies.invites.changeInviteStatus(invite.id, "accepted");
    await this.access.recordActivity({ accountId: invite.accountId, actorId: userId, objectType: "member", objectId: userId, summary: `Joined as ${invite.role}`, changes: [] });
    return { accountId: invite.accountId };
  }

  public async listActivity(userId: string, accountId: string, objectType: string | undefined, cursor: string | undefined, limit: number) {
    await this.access.requirePermission(userId, accountId, "account:view");
    const entries = await this.dependencies.invites.listActivity(accountId, objectType);
    const actors = new Map((await this.dependencies.userDirectory.findUserSummaries([...new Set(entries.flatMap((entry) => (entry.actorId === null ? [] : [entry.actorId])))])).map((user) => [user.id, user]));
    return paginateAdsItems(
      entries.map((entry) => ({
        id: entry.id,
        actor: entry.actorId === null ? { id: null, name: entry.actorLabel } : { id: entry.actorId, name: actors.get(entry.actorId)?.name ?? entry.actorLabel },
        objectType: entry.objectType,
        objectId: entry.objectId,
        summary: entry.summary,
        changes: entry.changes,
        createdAt: entry.createdAt.toISOString(),
      })),
      cursor,
      limit,
    );
  }

  private async findUsableInvite(token: string): Promise<AdAccountInviteRecord> {
    const invite = await this.dependencies.invites.findInviteByTokenHash(hashValue(token));
    if (invite === undefined || invite.status !== "pending" || invite.expiresAt <= this.dependencies.clock.now()) {
      throw adsError(404, "INVITE_NOT_FOUND", "This invite is invalid or has expired.");
    }
    return invite;
  }

  private async presentInvite(invite: AdAccountInviteRecord) {
    const [inviter] = await this.dependencies.userDirectory.findUserSummaries([invite.invitedById]);
    return {
      id: invite.id,
      email: await this.dependencies.cipher.decryptText(invite.emailCiphertext),
      role: invite.role,
      invitedBy: inviter?.name ?? "",
      status: invite.status,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
    };
  }
}
