import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { VerificationsController } from "../controllers/verifications.controller.js";
import {
  ApplyForVerificationBodySchema,
  ListVerificationsQuerySchema,
  MyVerificationQuerySchema,
  ProfileParamsSchema,
  ReviewReasonBodySchema,
  SellerVerificationBodySchema,
  StoreScopeQuerySchema,
} from "../validators/verifications.validator.js";

const BASE = "/api/v1/verification";
const TAG = "verification";

export function registerVerificationsRoutes(router: HttpRouter, controller: VerificationsController, web: WebKit): void {
  const { guard } = web;
  const applicant = guard.requirePermission("verification:apply");
  const reviewer = guard.requirePermission("verifications:review", web.limitSensitiveRequests);
  const review = { params: ProfileParamsSchema, body: ReviewReasonBodySchema };
  router.post(`${BASE}/apply`, controller.apply, { ...applicant, ...describeRoute(TAG, "Apply for verification (colour follows the profile type)", { body: ApplyForVerificationBodySchema }) });
  router.get(`${BASE}/me`, controller.getMine, { ...applicant, ...describeRoute(TAG, "Get my (or my store's) verification", { query: MyVerificationQuerySchema }) });
  router.get(BASE, controller.list, { ...guard.requirePermission("verifications:review"), ...describeRoute(TAG, "List verifications", { query: ListVerificationsQuerySchema }) });
  router.get(`${BASE}/:profileId`, controller.getPublic, { ...guard.allowAnyone(), ...describeRoute(TAG, "Get a profile's public verification", { params: ProfileParamsSchema }) });
  router.post(`${BASE}/:profileId/approve`, controller.approve, { ...reviewer, ...describeRoute(TAG, "Approve a pending verification", review) });
  router.post(`${BASE}/:profileId/reject`, controller.reject, { ...reviewer, ...describeRoute(TAG, "Reject a pending verification (reason required)", review) });
  router.post(`${BASE}/:profileId/suspend`, controller.suspend, { ...reviewer, ...describeRoute(TAG, "Suspend a verification (reason required)", review) });
  router.post(`${BASE}/:profileId/revoke`, controller.revoke, { ...reviewer, ...describeRoute(TAG, "Revoke a verification (reason required)", review) });
  router.get("/api/v1/seller/verification", controller.getSellerVerification, {
    ...guard.requirePermission("stores:manage"),
    ...describeRoute(TAG, "Get my store's Gold verification with masked KYC details", { query: StoreScopeQuerySchema }),
  });
  router.post("/api/v1/seller/verification", controller.submitSellerVerification, {
    ...guard.requirePermission("stores:manage"),
    ...describeRoute(TAG, "Submit or resubmit my store's KYC for Gold verification", { query: StoreScopeQuerySchema, body: SellerVerificationBodySchema }),
  });
}
