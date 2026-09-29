import type { EventBus } from "@zudojs/events";

import { NotificationRequestedEvent } from "../../../events/notificationRequested.event.js";
import { forbidden, notFound, unprocessable } from "../../../errors/domain.error.js";
import { PlatformRole, listDefaultPermissionsForPlatformRole } from "../../../constants/platformRoles.constant.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import type { StaffAccountChanges, StaffAccountRecord } from "../models/platformStaff.model.js";
import { isValidAllowListEntry } from "./ipAllowList.service.js";
import type { PlatformStaffService } from "./platformStaff.service.js";

export interface NewStaffAccountRequest {
  readonly userId?: string | undefined;
  readonly email?: string | undefined;
  readonly role: "admin" | "support" | "superadmin";
  readonly permissions?: readonly string[] | undefined;
  readonly ipAllowList?: readonly string[] | undefined;
}

export interface StaffAccountUpdateRequest {
  readonly role?: "admin" | "support" | "superadmin" | undefined;
  readonly permissions?: readonly string[] | undefined;
  readonly ipAllowList?: readonly string[] | undefined;
}

const SUPERADMIN_ONLY_BY_CLI = "Superadmin accounts can only be created or changed with the bootstrap command.";

function assertAllowListEntriesAreValid(entries: readonly string[]): readonly string[] {
  const invalid = entries.filter((entry) => !isValidAllowListEntry(entry.trim()));
  if (invalid.length > 0) throw unprocessable(`These IP allow-list entries are not valid: ${invalid.join(", ")}.`);
  return [...new Set(entries.map((entry) => entry.trim()))];
}

export class StaffAdministrationService {
  public constructor(private readonly staff: PlatformStaffService, private readonly events: EventBus) {}

  public async createStaffAccount(actor: Principal, request: NewStaffAccountRequest): Promise<StaffAccountRecord> {
    if (request.role === PlatformRole.SUPERADMIN) throw forbidden(SUPERADMIN_ONLY_BY_CLI);
    const { users, accounts, clock } = this.staff.dependencies;
    const user = request.userId !== undefined ? await users.findById(request.userId) : request.email === undefined ? undefined : await users.findByEmail(request.email.trim().toLowerCase());
    if (user === undefined || user.status !== "active") throw notFound("User");
    const permissions = this.staff.assertPermissionsAreAssignable(request.role, request.permissions ?? listDefaultPermissionsForPlatformRole(request.role));
    const account = await accounts.create(
      { userId: user.id, role: request.role, permissions, ipAllowList: assertAllowListEntriesAreValid(request.ipAllowList ?? []), createdById: actor.userId },
      clock.now(),
    );
    await this.staff.recordAdminChange(actor.userId, "admin.staff_account_created", user.id, undefined, account);
    await publishEvent(this.events, NotificationRequestedEvent, {
      userId: user.id,
      category: "messages",
      title: "You were added to the Zudomart admin team",
      body: "Sign in to the admin console and set up two-factor authentication to start.",
    });
    return account;
  }

  public async updateStaffAccount(actor: Principal, targetUserId: string, request: StaffAccountUpdateRequest): Promise<StaffAccountRecord> {
    const before = await this.findChangeableAccountOrThrow(actor, targetUserId);
    if (request.role === PlatformRole.SUPERADMIN) throw forbidden(SUPERADMIN_ONLY_BY_CLI);
    const role = request.role ?? before.role;
    const changes: StaffAccountChanges = {
      ...(request.role === undefined ? {} : { role: request.role }),
      ...(request.permissions === undefined ? {} : { permissions: this.staff.assertPermissionsAreAssignable(role, request.permissions) }),
      ...(request.ipAllowList === undefined ? {} : { ipAllowList: assertAllowListEntriesAreValid(request.ipAllowList) }),
    };
    return this.applyChanges(actor, before, changes, "admin.staff_account_updated");
  }

  public async changeStaffAccountStatus(actor: Principal, targetUserId: string, status: "active" | "disabled"): Promise<StaffAccountRecord> {
    const before = await this.findChangeableAccountOrThrow(actor, targetUserId);
    const now = this.staff.dependencies.clock.now();
    const changes: StaffAccountChanges = { status, disabledAt: status === "disabled" ? now : null };
    return this.applyChanges(actor, before, changes, status === "disabled" ? "admin.staff_account_disabled" : "admin.staff_account_enabled");
  }

  public async resetStaffMfa(actor: Principal, targetUserId: string): Promise<StaffAccountRecord> {
    const before = await this.findChangeableAccountOrThrow(actor, targetUserId);
    await this.staff.dependencies.mfa.resetTotp(before.userId);
    const after = await this.staff.findStaffAccountOrThrow(before.userId);
    await this.staff.recordAdminChange(actor.userId, "admin.staff_mfa_reset", before.userId, before, after);
    return after;
  }

  private async findChangeableAccountOrThrow(actor: Principal, targetUserId: string): Promise<StaffAccountRecord> {
    if (actor.userId === targetUserId) throw forbidden("Ask another superadmin to change your own admin account.");
    const account = await this.staff.findStaffAccountOrThrow(targetUserId);
    if (account.role === PlatformRole.SUPERADMIN) throw forbidden(SUPERADMIN_ONLY_BY_CLI);
    return account;
  }

  private async applyChanges(actor: Principal, before: StaffAccountRecord, changes: StaffAccountChanges, action: string): Promise<StaffAccountRecord> {
    const after = await this.staff.dependencies.accounts.update(before.userId, changes, this.staff.dependencies.clock.now());
    if (after === undefined) throw notFound("Staff account");
    await this.staff.recordAdminChange(actor.userId, action, before.userId, before, after);
    return after;
  }
}
