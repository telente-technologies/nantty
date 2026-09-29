import type { AppSettings } from "../../../configs/settings.config.js";
import { listEffectivePlatformPermissions } from "../../../constants/platformRoles.constant.js";
import type { AuditEntry, AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { TransactionalMailer } from "../../../interfaces/transactionalMailer.interface.js";
import { adminError } from "../../../utils/adminHttp.util.js";
import { hashSecretWithKey } from "../../../utils/hashToken.util.js";
import type { AuditRepository } from "../../audit/repositories/audit.repository.js";
import type { PasswordService } from "../../auth/services/password.service.js";
import { presentStaffStatus, type StaffAccountRecord } from "../models/platformStaff.model.js";
import type { StaffAccountsRepository } from "../repositories/staffAccounts.repository.js";
import type { StaffSecurityRepository } from "../repositories/staffSecurity.repository.js";
import type { AdminTokenService } from "./adminTokens.service.js";
import type { StaffMfaService } from "./staffMfa.service.js";
import type { WebAuthnCeremonies } from "./staffWebAuthn.service.js";

export interface StaffTokenHashKeys {
  readonly challenge: Uint8Array;
  readonly stepUp: Uint8Array;
  readonly invitation: Uint8Array;
}

export interface PlatformStaffDependencies {
  readonly accounts: StaffAccountsRepository;
  readonly security: StaffSecurityRepository;
  readonly tokens: AdminTokenService;
  readonly passwords: PasswordService;
  readonly mfa: StaffMfaService;
  readonly webAuthn: WebAuthnCeremonies;
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly auditLog: AuditRepository;
  readonly mailer: TransactionalMailer;
  readonly settings: AppSettings["platformAdmin"];
  readonly hashKeys: StaffTokenHashKeys;
}

export interface AdminIdentityDto {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly permissions: readonly string[];
}

export interface AdminAccountSummaryDto extends AdminIdentityDto {
  readonly status: string;
  readonly mfaEnrolled: boolean;
  readonly passkeyCount: number;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
  readonly createdByName: string | null;
}

export class PlatformStaffService {
  public constructor(public readonly dependencies: PlatformStaffDependencies) {}

  public async findAccountOrThrow(staffId: string): Promise<StaffAccountRecord> {
    const account = await this.dependencies.accounts.findById(staffId);
    if (account === undefined) throw adminError(404, "NOT_FOUND", "Admin was not found.");
    return account;
  }

  public hashToken(purpose: keyof StaffTokenHashKeys, token: string): Promise<string> {
    return hashSecretWithKey(token, this.dependencies.hashKeys[purpose]);
  }

  public presentIdentity(account: StaffAccountRecord): AdminIdentityDto {
    return {
      id: account.id,
      email: account.email,
      name: account.name,
      role: account.role,
      permissions: account.role === "SUPERADMIN" ? listEffectivePlatformPermissions(account.role, account.permissions) : [...account.permissions],
    };
  }

  public async presentAccountSummaries(accounts: readonly StaffAccountRecord[]): Promise<readonly AdminAccountSummaryDto[]> {
    const { security, clock } = this.dependencies;
    const creatorIds = [...new Set(accounts.flatMap((account) => (account.createdById === null ? [] : [account.createdById])))];
    const creators = new Map((await this.dependencies.accounts.findManyByIds(creatorIds)).map((creator) => [creator.id, creator.name]));
    const passkeyCounts = await Promise.all(accounts.map(async (account) => (await security.listWebAuthnCredentials(account.id)).length));
    const now = clock.now();
    return accounts.map((account, index) => ({
      ...this.presentIdentity(account),
      status: presentStaffStatus(account, now),
      mfaEnrolled: account.totpEnabledAt !== null,
      passkeyCount: passkeyCounts[index] ?? 0,
      lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
      createdAt: account.createdAt.toISOString(),
      createdByName: account.createdById === null ? null : creators.get(account.createdById) ?? null,
    }));
  }

  public async presentAccountSummary(account: StaffAccountRecord): Promise<AdminAccountSummaryDto> {
    const [summary] = await this.presentAccountSummaries([account]);
    return summary as AdminAccountSummaryDto;
  }

  public recordAudit(entry: Omit<AuditEntry, "area"> & { readonly area?: string }): Promise<void> {
    return this.dependencies.audit.record({ area: "admins", ...entry });
  }
}
