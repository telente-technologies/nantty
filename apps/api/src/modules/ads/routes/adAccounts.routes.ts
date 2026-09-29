import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { createOptionalIdempotencyKeyMiddleware } from "../../../middlewares/optionalIdempotency.middleware.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { AdAccountsController } from "../controllers/adAccounts.controller.js";
import { ActivityQuerySchema, ChangeMemberRoleBodySchema, CreateAdAccountBodySchema, CreateInviteBodySchema, UpdateAdAccountBodySchema } from "../validators/adAccounts.validator.js";

export const ADS_BASE_PATH = "/api/v1/ads";
const ACCOUNT_PATH = `${ADS_BASE_PATH}/accounts/:accountId`;

export function registerAdAccountsRoutes(router: HttpRouter, controller: AdAccountsController, web: WebKit): void {
  const signedIn = web.guard.requireSignedInUser();
  const signedInWithOptionalIdempotency = web.guard.requireSignedInUser(createOptionalIdempotencyKeyMiddleware(web.requireIdempotencyKey));
  router.get(`${ADS_BASE_PATH}/memberships`, controller.listMemberships, { ...signedIn, ...describeRoute("ads", "My ad account memberships and roles") });
  router.get(`${ADS_BASE_PATH}/accounts`, controller.listAccounts, { ...signedIn, ...describeRoute("ads", "Ad accounts I belong to") });
  router.post(`${ADS_BASE_PATH}/accounts`, controller.createAccount, { ...signedInWithOptionalIdempotency, ...describeRoute("ads", "Create an ad account", { body: CreateAdAccountBodySchema }) });
  router.get(`${ADS_BASE_PATH}/business-profiles`, controller.listBusinessProfiles, { ...signedIn, ...describeRoute("ads", "Stores I can link to an ad account") });
  router.get(ACCOUNT_PATH, controller.getAccount, { ...signedIn, ...describeRoute("ads", "Ad account details") });
  router.patch(ACCOUNT_PATH, controller.updateAccount, { ...signedIn, ...describeRoute("ads", "Update an ad account", { body: UpdateAdAccountBodySchema }) });
  router.get(`${ACCOUNT_PATH}/entitlements`, controller.getEntitlements, { ...signedIn, ...describeRoute("ads", "Ads entitlements (verified business, monthly credit)") });
  router.get(`${ACCOUNT_PATH}/members`, controller.listMembers, { ...signedIn, ...describeRoute("ads", "Ad account members") });
  router.patch(`${ACCOUNT_PATH}/members/:userId`, controller.changeMemberRole, { ...signedIn, ...describeRoute("ads", "Change a member's role", { body: ChangeMemberRoleBodySchema }) });
  router.delete(`${ACCOUNT_PATH}/members/:userId`, controller.removeMember, { ...signedIn, ...describeRoute("ads", "Remove a member") });
  router.get(`${ACCOUNT_PATH}/invites`, controller.listInvites, { ...signedIn, ...describeRoute("ads", "Pending invites") });
  router.post(`${ACCOUNT_PATH}/invites`, controller.createInvite, { ...signedInWithOptionalIdempotency, ...describeRoute("ads", "Invite someone by email", { body: CreateInviteBodySchema }) });
  router.delete(`${ACCOUNT_PATH}/invites/:inviteId`, controller.revokeInvite, { ...signedIn, ...describeRoute("ads", "Revoke an invite") });
  router.get(`${ADS_BASE_PATH}/invites/:token`, controller.previewInvite, { ...signedIn, ...describeRoute("ads", "Preview an invite") });
  router.post(`${ADS_BASE_PATH}/invites/:token/accept`, controller.acceptInvite, { ...signedIn, ...describeRoute("ads", "Accept an invite") });
  router.get(`${ACCOUNT_PATH}/activity`, controller.listActivity, { ...signedIn, ...describeRoute("ads", "Account activity log", { query: ActivityQuerySchema }) });
}
