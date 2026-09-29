import { ForbiddenError, UnauthorizedError } from "@zudojs/errors";

import type { AppSettings } from "../../../configs/settings.config.js";
import { isPlatformPermission, type Permission } from "../../../constants/permissions.constant.js";
import { PlatformRole, platformRoleGrantsPermission } from "../../../constants/platformRoles.constant.js";
import { notFound } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { PlatformStaffAccessCheck, StaffRequestDetails } from "../../../interfaces/platformStaffAccess.interface.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { PasswordService } from "../../auth/services/password.service.js";
import type { TokenService } from "../../auth/services/token.service.js";
import type { UserRecord } from "../../users/models/users.model.js";
import type { UsersRepository } from "../../users/repositories/users.repository.js";
import { snapshotStaffAccountForAudit, type StaffAccountRecord, type StaffSessionRecord } from "../models/platformStaff.model.js";
import type { StaffAccountsRepository, StaffSecurityRepository } from "../repositories/platformStaff.repository.js";
import { ipAddressIsInAllowList } from "./ipAllowList.service.js";
import type { StaffMfaService } from "./staffMfa.service.js";
import type { WebAuthnVerifier } from "./webAuthn.service.js";

export interface PlatformStaffDependencies {
  readonly accounts: StaffAccountsRepository;
  readonly security: StaffSecurityRepository;
  readonly users: UsersRepository;
  readonly tokens: TokenService;
  readonly passwords: PasswordService;
  readonly mfa: StaffMfaService;
  readonly webAuthn: WebAuthnVerifier;
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly settings: AppSettings["platformAdmin"];
}

const ADMIN_CONSOLE_REQUIRED = "Sign in to the admin console with two-factor authentication to do this.";

export class PlatformStaffService implements PlatformStaffAccessCheck {
  public constructor(public readonly dependencies: PlatformStaffDependencies) {}

  public async assertStaffMayUsePermission(principal: Principal, permission: Permission | undefined, request: StaffRequestDetails): Promise<void> {
    const { account } = await this.findVerifiedStaffSessionOrThrow(principal);
    if (!ipAddressIsInAllowList(request.clientIp, account.ipAllowList)) {
      throw new ForbiddenError("The admin console cannot be used from this network.");
    }
    if (permission !== undefined && !platformRoleGrantsPermission(account.role, account.permissions, permission)) {
      throw new ForbiddenError("You do not have permission to do this.");
    }
  }

  public async assertRecentStepUp(principal: Principal): Promise<void> {
    const { session } = await this.findVerifiedStaffSessionOrThrow(principal);
    if (!this.stepUpIsStillValid(session)) {
      throw new ForbiddenError("Confirm it is you: verify your authenticator code again to continue.");
    }
  }

  public async recordStaffAction(principal: Principal, request: StaffRequestDetails, outcome: { readonly permission: string; readonly status: number }): Promise<void> {
    await this.dependencies.audit.record({
      actorId: principal.userId,
      action: "admin.request",
      entityType: "admin_route",
      entityId: `${request.method} ${request.path}`,
      metadata: { permission: outcome.permission, status: outcome.status, sessionId: principal.sessionId },
      ...(request.clientIp === null ? {} : { ip: request.clientIp }),
    });
  }

  public async findVerifiedStaffSessionOrThrow(principal: Principal): Promise<{ readonly account: StaffAccountRecord; readonly session: StaffSessionRecord }> {
    if (principal.sessionKind !== "admin") throw new ForbiddenError(ADMIN_CONSOLE_REQUIRED);
    const [account, session] = await Promise.all([
      this.dependencies.accounts.findByUserId(principal.userId),
      this.dependencies.security.findStaffSession(principal.sessionId),
    ]);
    if (account === undefined || account.status !== "active") throw new ForbiddenError("You do not have permission to do this.");
    if (session === undefined || session.userId !== principal.userId) throw new UnauthorizedError(ADMIN_CONSOLE_REQUIRED);
    return { account, session };
  }

  public stepUpIsStillValid(session: StaffSessionRecord): boolean {
    const verifiedAt = session.stepUpVerifiedAt ?? session.mfaVerifiedAt;
    return this.dependencies.clock.now().getTime() - verifiedAt.getTime() <= this.dependencies.settings.stepUpWindowSeconds * 1000;
  }

  public stepUpValidUntil(session: StaffSessionRecord): Date {
    const verifiedAt = session.stepUpVerifiedAt ?? session.mfaVerifiedAt;
    return new Date(verifiedAt.getTime() + this.dependencies.settings.stepUpWindowSeconds * 1000);
  }

  public async findStaffAccountOrThrow(userId: string): Promise<StaffAccountRecord> {
    const account = await this.dependencies.accounts.findByUserId(userId);
    if (account === undefined) throw notFound("Staff account");
    return account;
  }

  public async findUserOrThrow(userId: string): Promise<UserRecord> {
    const user = await this.dependencies.users.findById(userId);
    if (user === undefined) throw notFound("User");
    return user;
  }

  public describeAccountLabel(user: UserRecord): string {
    return user.email ?? user.username;
  }

  public assertPermissionsAreAssignable(role: PlatformRole, permissions: readonly string[]): readonly Permission[] {
    const unknown = permissions.filter((permission) => !isPlatformPermission(permission));
    if (unknown.length > 0) throw new ForbiddenError(`Unknown admin permissions: ${unknown.join(", ")}.`);
    if (role !== PlatformRole.SUPERADMIN && permissions.includes("admins:manage")) {
      throw new ForbiddenError("Only superadmins can manage admin accounts.");
    }
    return [...new Set(permissions)] as Permission[];
  }

  public async recordAdminChange(actorId: string | null, action: string, targetUserId: string, before: StaffAccountRecord | undefined, after: StaffAccountRecord | undefined): Promise<void> {
    await this.dependencies.audit.record({
      actorId,
      action,
      entityType: "platform_staff_account",
      entityId: targetUserId,
      before: before === undefined ? null : snapshotStaffAccountForAudit(before),
      after: after === undefined ? null : snapshotStaffAccountForAudit(after),
    });
  }
}
