import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { AdminAuthController } from "../controllers/adminAuth.controller.js";
import type { AdminStaffController } from "../controllers/adminStaff.controller.js";
import {
  AdminChallengeBodySchema,
  AdminCompleteLoginBodySchema,
  AdminLoginBodySchema,
  AdminStepUpBodySchema,
  CreateStaffAccountBodySchema,
  StaffAccountParamsSchema,
  UpdateStaffAccountBodySchema,
  WebAuthnCredentialParamsSchema,
} from "../validators/admin.validator.js";

const ADMIN = "/api/v1/admin";
const TAG = "admin";

export function registerAdminAuthRoutes(router: HttpRouter, controller: AdminAuthController, web: WebKit): void {
  const { guard, limitSensitiveRequests } = web;
  const sensitive = guard.allowAnyone(limitSensitiveRequests);
  router.post(`${ADMIN}/auth/login`, controller.startLogin, { ...sensitive, ...describeRoute(TAG, "Start an admin console sign-in", { body: AdminLoginBodySchema }) });
  router.post(`${ADMIN}/auth/mfa/enroll`, controller.beginTotpEnrollment, { ...sensitive, ...describeRoute(TAG, "Get a new authenticator secret during first sign-in", { body: AdminChallengeBodySchema }) });
  router.post(`${ADMIN}/auth/mfa/verify`, controller.completeLogin, { ...sensitive, ...describeRoute(TAG, "Finish an admin sign-in with an authenticator or recovery code", { body: AdminCompleteLoginBodySchema }) });
  router.post(`${ADMIN}/auth/step-up`, controller.stepUp, { ...guard.requirePlatformStaff(limitSensitiveRequests), ...describeRoute(TAG, "Re-verify before a sensitive admin action", { body: AdminStepUpBodySchema }) });
}

export function registerAdminStaffRoutes(router: HttpRouter, controller: AdminStaffController, web: WebKit): void {
  const { guard } = web;
  const staff = guard.requirePlatformStaff();
  const manageAdmins = guard.requirePermission("admins:manage");
  const manageAdminsWithStepUp = guard.requireStepUpPermission("admins:manage");
  router.get(`${ADMIN}/me`, controller.getMe, { ...staff, ...describeRoute(TAG, "Get my admin account, permissions and session") });
  router.get(`${ADMIN}/permissions`, controller.listPermissions, { ...staff, ...describeRoute(TAG, "List admin permissions and role defaults") });
  router.post(`${ADMIN}/mfa/recovery-codes`, controller.regenerateRecoveryCodes, { ...guard.requirePlatformStaff(), ...describeRoute(TAG, "Replace my recovery codes") });
  router.get(`${ADMIN}/mfa/webauthn/credentials`, controller.listWebAuthnCredentials, { ...staff, ...describeRoute(TAG, "List my security keys") });
  router.post(`${ADMIN}/mfa/webauthn/registration-options`, controller.createWebAuthnRegistrationOptions, { ...staff, ...describeRoute(TAG, "Start adding a security key") });
  router.delete(`${ADMIN}/mfa/webauthn/credentials/:id`, controller.removeWebAuthnCredential, { ...staff, ...describeRoute(TAG, "Remove a security key", { params: WebAuthnCredentialParamsSchema }) });
  router.get(`${ADMIN}/admins`, controller.listAccounts, { ...manageAdmins, ...describeRoute(TAG, "List admin and support accounts") });
  router.post(`${ADMIN}/admins`, controller.createAccount, { ...manageAdminsWithStepUp, ...describeRoute(TAG, "Add an admin or support agent", { body: CreateStaffAccountBodySchema }) });
  router.get(`${ADMIN}/admins/:userId`, controller.getAccount, { ...manageAdmins, ...describeRoute(TAG, "Get an admin account", { params: StaffAccountParamsSchema }) });
  router.patch(`${ADMIN}/admins/:userId`, controller.updateAccount, { ...manageAdminsWithStepUp, ...describeRoute(TAG, "Change an admin's role, permissions or IP allow-list", { params: StaffAccountParamsSchema, body: UpdateStaffAccountBodySchema }) });
  router.post(`${ADMIN}/admins/:userId/disable`, controller.disableAccount, { ...manageAdminsWithStepUp, ...describeRoute(TAG, "Disable an admin account", { params: StaffAccountParamsSchema }) });
  router.post(`${ADMIN}/admins/:userId/enable`, controller.enableAccount, { ...manageAdminsWithStepUp, ...describeRoute(TAG, "Re-enable an admin account", { params: StaffAccountParamsSchema }) });
  router.post(`${ADMIN}/admins/:userId/mfa/reset`, controller.resetMfa, { ...manageAdminsWithStepUp, ...describeRoute(TAG, "Reset an admin's two-factor authentication", { params: StaffAccountParamsSchema }) });
}
