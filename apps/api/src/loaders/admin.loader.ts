import { createHmac } from "node:crypto";

import type { AuditRecorder } from "../interfaces/audit.interface.js";
import { AdminAuthController } from "../modules/admin/controllers/adminAuth.controller.js";
import { AdminStaffController } from "../modules/admin/controllers/adminStaff.controller.js";
import { registerAdminCommandAndQueryHandlers } from "../modules/admin/admin.module.js";
import { PrismaStaffSecurityRepository } from "../modules/admin/repositories/platformStaff.prisma.repository.js";
import { InMemoryStaffSecurityRepository, type StaffAccountsRepository } from "../modules/admin/repositories/platformStaff.repository.js";
import { AdminSessionService } from "../modules/admin/services/adminSession.service.js";
import { PlatformStaffService } from "../modules/admin/services/platformStaff.service.js";
import { StaffAdministrationService } from "../modules/admin/services/staffAdministration.service.js";
import { StaffMfaService } from "../modules/admin/services/staffMfa.service.js";
import { UnavailableWebAuthnVerifier, type WebAuthnVerifier } from "../modules/admin/services/webAuthn.service.js";
import type { AuthService } from "../modules/auth/services/auth.service.js";
import type { PasswordService } from "../modules/auth/services/password.service.js";
import type { TokenService } from "../modules/auth/services/token.service.js";
import type { UsersRepository } from "../modules/users/repositories/users.repository.js";
import type { Core } from "./core.loader.js";

export interface AdminExternalServices {
  readonly webAuthnVerifier?: WebAuthnVerifier;
}

export interface IdentityInternals {
  readonly users: UsersRepository;
  readonly staffAccounts: StaffAccountsRepository;
  readonly tokens: TokenService;
  readonly passwords: PasswordService;
  readonly authService: AuthService;
}

function derivePlatformAdminHashKey(dataEncryptionKey: Uint8Array, purpose: string): Uint8Array {
  return new Uint8Array(createHmac("sha256", dataEncryptionKey).update(purpose).digest());
}

export function createPlatformStaffServices(core: Core, identity: IdentityInternals, audit: AuditRecorder, external: AdminExternalServices = {}) {
  const hashKeys = {
    challenge: derivePlatformAdminHashKey(core.settings.dataEncryptionKey, "admin-login-challenge"),
    recoveryCodes: derivePlatformAdminHashKey(core.settings.dataEncryptionKey, "admin-recovery-codes"),
  };
  const settings = core.settings.platformAdmin;
  const webAuthn = external.webAuthnVerifier ?? new UnavailableWebAuthnVerifier();
  const mfa = new StaffMfaService(identity.staffAccounts, core.cipher, hashKeys.recoveryCodes, core.clock, settings.totpIssuer);
  const staff = new PlatformStaffService({
    accounts: identity.staffAccounts,
    security: core.persistence === "prisma" ? new PrismaStaffSecurityRepository() : new InMemoryStaffSecurityRepository(),
    users: identity.users,
    tokens: identity.tokens,
    passwords: identity.passwords,
    mfa,
    webAuthn,
    clock: core.clock,
    audit,
    settings,
  });
  return {
    staff,
    sessions: new AdminSessionService(staff, identity.authService, hashKeys.challenge),
    administration: new StaffAdministrationService(staff, core.events),
  };
}

export function createAdminModule(core: Core, identity: IdentityInternals, audit: AuditRecorder, external: AdminExternalServices = {}) {
  const services = createPlatformStaffServices(core, identity, audit, external);
  registerAdminCommandAndQueryHandlers(core.commands, core.queries, services);
  return {
    platformStaff: services.staff,
    controllers: {
      adminAuthController: new AdminAuthController(core.commands),
      adminStaffController: new AdminStaffController(core.commands, core.queries, services.staff.dependencies.webAuthn),
    },
  };
}
