import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { CreatorAdminController } from "../controllers/creatorAdmin.controller.js";
import type { CreatorsController } from "../controllers/creators.controller.js";
import {
  AffiliateCommissionBodySchema,
  AffiliateCommissionQuerySchema,
  AffiliateTargetBodySchema,
  CreatorStandingBodySchema,
  DashboardQuerySchema,
  IdParamsSchema,
  ListCreatorApplicationsQuerySchema,
  PageQuerySchema,
  ReviewCreatorApplicationBodySchema,
  SendLiveGiftBodySchema,
  UserIdParamsSchema,
} from "../validators/creators.validator.js";

const TAG = "creators";
const CREATORS = "/api/v1/creators";

export function registerCreatorsRoutes(router: HttpRouter, controller: CreatorsController, web: WebKit): void {
  const { guard, requireIdempotencyKey } = web;
  const signedIn = guard.requireSignedInUser();
  const write = guard.requirePermission("social:write");

  router.get(`${CREATORS}/me`, controller.me, { ...signedIn, ...describeRoute(TAG, "My Creator Program status") });
  router.get(`${CREATORS}/eligibility`, controller.eligibility, { ...signedIn, ...describeRoute(TAG, "Creator Program eligibility checklist") });
  router.post(`${CREATORS}/applications`, controller.apply, { ...write, ...describeRoute(TAG, "Apply to the Creator Program (422 lists unmet criteria)") });
  router.get(`${CREATORS}/applications/me`, controller.myApplication, { ...signedIn, ...describeRoute(TAG, "My latest creator application") });
  router.get(`${CREATORS}/dashboard`, controller.dashboard, { ...signedIn, ...describeRoute(TAG, "Creator dashboard", { query: DashboardQuerySchema }) });
  router.get(`${CREATORS}/earnings`, controller.earnings, { ...signedIn, ...describeRoute(TAG, "Creator earnings: gifts and affiliate commissions", { query: PageQuerySchema }) });
  router.get(`${CREATORS}/affiliations`, controller.affiliations, { ...signedIn, ...describeRoute(TAG, "Stores and products I promote with their commission") });
  router.post(`${CREATORS}/affiliations`, controller.addAffiliation, { ...write, ...describeRoute(TAG, "Promote a store or product", { body: AffiliateTargetBodySchema }) });
  router.delete(`${CREATORS}/affiliations`, controller.removeAffiliation, { ...write, ...describeRoute(TAG, "Stop promoting a store or product", { query: AffiliateTargetBodySchema }) });
  router.get("/api/v1/gifts", controller.giftCatalog, { ...guard.allowAnyone(), ...describeRoute(TAG, "Live gift catalog with prices per currency") });
  router.post("/api/v1/lives/:id/gifts", controller.sendGift, {
    ...guard.requirePermission("social:write", requireIdempotencyKey),
    ...describeRoute(TAG, "Send a paid gift to the host of a live session", { params: IdParamsSchema, body: SendLiveGiftBodySchema }),
  });
}

export function registerCreatorAdminRoutes(router: HttpRouter, controller: CreatorAdminController, web: WebKit): void {
  const { guard } = web;
  const admin = guard.requirePermission("creators:review");
  const seller = guard.requirePermission("products:manage");
  const standing = { params: UserIdParamsSchema, body: CreatorStandingBodySchema };

  router.get("/api/v1/admin/creator-applications", controller.listApplications, { ...admin, ...describeRoute(TAG, "List creator applications", { query: ListCreatorApplicationsQuerySchema }) });
  router.post("/api/v1/admin/creator-applications/:id/review", controller.reviewApplication, {
    ...admin,
    ...describeRoute(TAG, "Approve or reject a creator application", { params: IdParamsSchema, body: ReviewCreatorApplicationBodySchema }),
  });
  router.post("/api/v1/admin/creators/:userId/suspend", controller.suspend, { ...admin, ...describeRoute(TAG, "Suspend a creator", standing) });
  router.post("/api/v1/admin/creators/:userId/reinstate", controller.reinstate, { ...admin, ...describeRoute(TAG, "Reinstate a suspended creator", standing) });
  router.get("/api/v1/seller/affiliates/commissions", controller.listCommissions, { ...seller, ...describeRoute(TAG, "My store's affiliate commissions", { query: AffiliateCommissionQuerySchema }) });
  router.put("/api/v1/seller/affiliates/commissions", controller.setCommission, {
    ...seller,
    ...describeRoute(TAG, "Set a store-level (no productId) or product-level affiliate commission", { body: AffiliateCommissionBodySchema }),
  });
  router.delete("/api/v1/seller/affiliates/commissions", controller.removeCommission, { ...seller, ...describeRoute(TAG, "Remove an affiliate commission", { query: AffiliateCommissionQuerySchema }) });
}
