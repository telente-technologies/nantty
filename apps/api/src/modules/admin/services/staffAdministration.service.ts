import { randomBytes } from "node:crypto";

import { PlatformRole, isAssignablePlatformPermission, type PlatformRole as PlatformRoleValue } from "../../../constants/platformRoles.constant.js";
import { adminError, type NumberedPage, type NumberedPageRequest } from "../../../utils/adminHttp.util.js";
import { convertAuditEventToLogEntry } from "../../audit/dtos/auditLogEntry.dto.js";
import { snapshotStaffAccountForAudit, type StaffAccountChanges, type StaffAccountFilter, type StaffAccountRecord } from "../models/platformStaff.model.js";
import type { AdminLoginStarted, AdminSignInService } from "./adminSignIn.service.js";
import type { AdminAccountSummaryDto, PlatformStaffService } from "./platformStaff.service.js";
import { assertStaffPasswordIsStrong } from "./staffPasswordPolicy.service.js";

export interface StaffActor {
  readonly id: string;
}

export interface NewAdminRequest {
  readonly email: string;
  readonly name: string;
  readonly role: "ADMIN" | "SUPPORT";
  readonly permissions: readonly string[];
  readonly reason: string;
}

export interface AdminInvitationPreview {
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly expiresAt: string;
}

function assertPermissionKeysAreKnown(permissions: readonly string[]): readonly string[] {
  const unknown = permissions.filter((permission) => !isAssignablePlatformPermission(permission));
  if (unknown.length > 0) {
    throw adminError(400, "VALIDATION_FAILED", `Unknown permission keys: ${unknown.join(", ")}.`, { issues: [{ path: "permissions", message: `Unknown permission keys: ${unknown.join(", ")}` }] });
  }
  return [...new Set(permissions)];
}

export class StaffAdministrationService {
  public constructor(private readonly staff: PlatformStaffService, private readonly signIn: AdminSignInService) {}

  public async listAdmins(filter: StaffAccountFilter, page: NumberedPageRequest): Promise<NumberedPage<AdminAccountSummaryDto>> {
    const { accounts, clock } = this.staff.dependencies;
    const found = await accounts.list(filter, page, clock.now());
    return { ...found, items: await this.staff.presentAccountSummaries(found.items) };
  }

  public async describeAdmin(staffId: string) {
    const { security, auditLog, clock } = this.staff.dependencies;
    const account = await this.staff.findAccountOrThrow(staffId);
    const [admin, sessions, history] = await Promise.all([
      this.staff.presentAccountSummary(account),
      security.listActiveSessions(account.id, clock.now()),
      auditLog.listForTargets([{ entityType: "admin", entityId: account.id }], 50),
    ]);
    return { admin, activeSessionCount: sessions.length, history: history.map(convertAuditEventToLogEntry) };
  }

  public async inviteAdmin(actor: StaffActor, request: NewAdminRequest) {
    const { accounts, security, clock, settings, mailer } = this.staff.dependencies;
    const email = request.email.trim().toLowerCase();
    const domain = email.split("@")[1] ?? "";
    if (!settings.invitationEmailDomains.includes(domain)) {
      throw adminError(400, "VALIDATION_FAILED", "Admins must use an approved work email domain.", { issues: [{ path: "email", message: "This email domain is not allowed for admins." }] });
    }
    const permissions = assertPermissionKeysAreKnown(request.permissions);
    const now = clock.now();
    const account = await accounts.create({ email, name: request.name.trim(), passwordHash: null, role: request.role, permissions, status: "INVITED", ipAllowList: [], createdById: actor.id }, now);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + settings.invitationTtlSeconds * 1000);
    await security.createInvitation(account.id, await this.staff.hashToken("invitation", token), expiresAt, actor.id, now);
    await mailer.sendTransactionalEmail({
      to: email,
      subject: "You have been invited to the Zudomart admin console",
      text: `Hello ${account.name},\n\nYou have been invited to the Zudomart admin console as ${request.role}. Set your password and two-factor authentication here within ${Math.round(settings.invitationTtlSeconds / 3600)} hours:\n${settings.consoleUrl}/invitations/${token}\n\nIf you did not expect this, ignore this email.`,
    });
    await this.recordChange(actor, "admin.created", request.reason, undefined, account);
    return { admin: await this.staff.presentAccountSummary(account), invitationSentTo: email, invitationExpiresInHours: Math.round(settings.invitationTtlSeconds / 3600) };
  }

  public async changePermissions(actor: StaffActor, staffId: string, role: PlatformRoleValue, permissions: readonly string[], reason: string) {
    const before = await this.findChangeableAdminOrThrow(actor, staffId);
    if (role === PlatformRole.SUPERADMIN) throw adminError(409, "SUPERADMIN_PROTECTED", "Superadmins can only be created with the bootstrap command.");
    return this.applyChange(actor, before, { role, permissions: assertPermissionKeysAreKnown(permissions) }, "admin.permissions_changed", reason);
  }

  public async disableAdmin(actor: StaffActor, staffId: string, reason: string) {
    const before = await this.findChangeableAdminOrThrow(actor, staffId);
    const { security, clock } = this.staff.dependencies;
    await security.revokeAllSessions(before.id, "admin_disabled", clock.now());
    return this.applyChange(actor, before, { status: "DISABLED", disabledAt: clock.now() }, "admin.disable", reason);
  }

  public async enableAdmin(actor: StaffActor, staffId: string, reason: string) {
    const before = await this.findChangeableAdminOrThrow(actor, staffId);
    const status = before.passwordHash === null ? "INVITED" : "ACTIVE";
    return this.applyChange(actor, before, { status, disabledAt: null, lockedUntil: null, failedLoginCount: 0 }, "admin.enable", reason);
  }

  public async resetMfa(actor: StaffActor, staffId: string, reason: string) {
    const before = await this.findChangeableAdminOrThrow(actor, staffId);
    const { mfa, security, clock } = this.staff.dependencies;
    await mfa.removeAllSecondFactors(before.id);
    await security.removeAllWebAuthnCredentials(before.id);
    await security.revokeAllSessions(before.id, "mfa_reset", clock.now());
    const after = await this.staff.findAccountOrThrow(before.id);
    await this.recordChange(actor, "admin.reset_mfa", reason, before, after);
    return { admin: await this.staff.presentAccountSummary(after) };
  }

  public async previewInvitation(token: string): Promise<AdminInvitationPreview> {
    const { invitation, account } = await this.findUsableInvitationOrThrow(token);
    return { email: account.email, name: account.name, role: account.role, expiresAt: invitation.expiresAt.toISOString() };
  }

  public async acceptInvitation(token: string, password: string): Promise<AdminLoginStarted> {
    const { passwords, accounts, security, clock } = this.staff.dependencies;
    const { invitation, account } = await this.findUsableInvitationOrThrow(token);
    assertStaffPasswordIsStrong(password, account.email, account.name);
    if (!(await security.markInvitationAccepted(invitation.id, clock.now()))) throw adminError(404, "INVITATION_INVALID", "This invitation link is not valid.");
    const updated = await accounts.update(account.id, { passwordHash: await passwords.hashNewPassword(password), status: "ACTIVE" }, clock.now());
    await this.staff.recordAudit({ actorId: account.id, actorKind: "ADMIN", actorName: account.name, actorRole: account.role, action: "admin.invitation_accepted", entityType: "admin", entityId: account.id, targetLabel: account.email });
    return this.signIn.issueMfaChallenge(updated ?? account, false);
  }

  private async findUsableInvitationOrThrow(token: string) {
    const { security, accounts, clock } = this.staff.dependencies;
    const invitation = await security.findInvitationByTokenHash(await this.staff.hashToken("invitation", token));
    if (invitation === undefined || invitation.acceptedAt !== null || invitation.revokedAt !== null) throw adminError(404, "INVITATION_INVALID", "This invitation link is not valid.");
    if (invitation.expiresAt <= clock.now()) throw adminError(410, "INVITATION_EXPIRED", "This invitation has expired. Ask a superadmin for a new one.");
    const account = await accounts.findById(invitation.staffId);
    if (account === undefined || account.status !== "INVITED") throw adminError(404, "INVITATION_INVALID", "This invitation link is not valid.");
    return { invitation, account };
  }

  private async findChangeableAdminOrThrow(actor: StaffActor, staffId: string): Promise<StaffAccountRecord> {
    if (actor.id === staffId) throw adminError(409, "CANNOT_CHANGE_SELF", "Ask another superadmin to change your own account.");
    const account = await this.staff.findAccountOrThrow(staffId);
    if (account.role === PlatformRole.SUPERADMIN) throw adminError(409, "SUPERADMIN_PROTECTED", "Superadmin accounts cannot be changed here.");
    return account;
  }

  private async applyChange(actor: StaffActor, before: StaffAccountRecord, changes: StaffAccountChanges, action: string, reason: string) {
    const { accounts, clock } = this.staff.dependencies;
    const after = await accounts.update(before.id, changes, clock.now());
    if (after === undefined) throw adminError(404, "NOT_FOUND", "Admin was not found.");
    await this.recordChange(actor, action, reason, before, after);
    return { admin: await this.staff.presentAccountSummary(after) };
  }

  private recordChange(actor: StaffActor, action: string, reason: string, before: StaffAccountRecord | undefined, after: StaffAccountRecord): Promise<void> {
    return this.staff.recordAudit({
      actorId: actor.id,
      action,
      entityType: "admin",
      entityId: after.id,
      targetLabel: after.email,
      reason,
      before: before === undefined ? null : snapshotStaffAccountForAudit(before),
      after: snapshotStaffAccountForAudit(after),
    });
  }
}
