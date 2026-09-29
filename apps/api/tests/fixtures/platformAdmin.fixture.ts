import type { HttpTestClient } from "@zudojs/testing";

import type { AppDependencies } from "../../src/container.js";
import { ADMIN_PERMISSIONS, SUPERADMIN_ONLY_PERMISSIONS, type Permission } from "../../src/constants/permissions.constant.js";
import type { PlatformRole } from "../../src/constants/platformRoles.constant.js";
import type { Clock } from "../../src/interfaces/clock.interface.js";
import { generateTotpCode } from "../../src/modules/admin/services/totp.service.js";

export interface PlatformStaffOptions {
  readonly role?: PlatformRole;
  readonly permissions?: readonly Permission[];
  readonly ipAllowList?: readonly string[];
}

export interface SignedInStaffSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly totpSecret: string;
  readonly recoveryCodes: readonly string[];
}

export function listEveryAssignableAdminPermission(): readonly Permission[] {
  return ADMIN_PERMISSIONS.filter((permission) => !SUPERADMIN_ONLY_PERMISSIONS.has(permission));
}

export async function provisionPlatformStaffAndSignIn(
  client: HttpTestClient,
  dependencies: AppDependencies,
  clock: Clock & { advanceBySeconds(seconds: number): void },
  user: { readonly userId: string; readonly email: string; readonly password: string },
  options: PlatformStaffOptions = {},
): Promise<SignedInStaffSession> {
  const staff = dependencies.ports.platformStaff;
  const { accounts, mfa } = staff.dependencies;
  const account = await accounts.create(
    { userId: user.userId, role: options.role ?? "admin", permissions: options.permissions ?? listEveryAssignableAdminPermission(), ipAllowList: options.ipAllowList ?? [], createdById: null },
    clock.now(),
  );
  const enrollment = await mfa.enableTotpImmediately(account, user.email);
  const started = await client.post("/api/v1/admin/auth/login").send({ identifier: user.email, password: user.password }).expect(200);
  const { challengeToken } = started.json<{ challengeToken: string }>();
  const completed = await client
    .post("/api/v1/admin/auth/mfa/verify")
    .send({ challengeToken, code: generateTotpCode(enrollment.secret, clock.now()) })
    .expect(200);
  const tokens = completed.json<{ accessToken: string; refreshToken: string }>();
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, totpSecret: enrollment.secret, recoveryCodes: enrollment.recoveryCodes };
}

export async function signInPlatformStaffAgain(
  client: HttpTestClient,
  clock: Clock & { advanceBySeconds(seconds: number): void },
  staff: { readonly email: string; readonly password: string; readonly totpSecret: string },
): Promise<string> {
  clock.advanceBySeconds(30);
  const started = await client.post("/api/v1/admin/auth/login").send({ identifier: staff.email, password: staff.password }).expect(200);
  const { challengeToken } = started.json<{ challengeToken: string }>();
  const completed = await client
    .post("/api/v1/admin/auth/mfa/verify")
    .send({ challengeToken, code: generateTotpCode(staff.totpSecret, clock.now()) })
    .expect(200);
  return completed.json<{ accessToken: string }>().accessToken;
}
