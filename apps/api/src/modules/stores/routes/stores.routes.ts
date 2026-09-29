import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { SellerApplicationsController } from "../controllers/sellerApplications.controller.js";
import type { StoresController } from "../controllers/stores.controller.js";
import {
  AddStoreMemberBodySchema,
  ApplicationParamsSchema,
  CreateStoreBodySchema,
  FeatureStoreBodySchema,
  ListSellerApplicationsQuerySchema,
  ListStoresQuerySchema,
  ReviewSellerApplicationBodySchema,
  StoreMemberParamsSchema,
  StoreParamsSchema,
  StoreSlugParamsSchema,
  StoreStatusBodySchema,
  SubmitSellerApplicationBodySchema,
  UpdateStoreBodySchema,
} from "../validators/stores.validator.js";

const STORES = "/api/v1/stores";
const TAG = "stores";

export function registerStoresRoutes(router: HttpRouter, controller: StoresController, web: WebKit): void {
  const { guard } = web;
  const seller = guard.requirePermission("stores:manage");
  const admin = guard.requirePermission("stores:suspend");

  router.get(STORES, controller.list, { ...guard.allowAnyone(), ...describeRoute(TAG, "List stores", { query: ListStoresQuerySchema }) });
  router.get(`${STORES}/mine`, controller.listMine, { ...seller, ...describeRoute(TAG, "List the stores I belong to") });
  router.get(`${STORES}/slug/:slug`, controller.getBySlug, { ...guard.allowAnyone(), ...describeRoute(TAG, "Get a store by its link", { params: StoreSlugParamsSchema }) });
  router.post(STORES, controller.create, { ...seller, ...describeRoute(TAG, "Create a store", { body: CreateStoreBodySchema }) });
  router.patch(`${STORES}/:id`, controller.update, { ...seller, ...describeRoute(TAG, "Update a store", { params: StoreParamsSchema, body: UpdateStoreBodySchema }) });
  router.get(`${STORES}/:id/members`, controller.listMembers, { ...seller, ...describeRoute(TAG, "List store members", { params: StoreParamsSchema }) });
  router.post(`${STORES}/:id/members`, controller.addMember, { ...seller, ...describeRoute(TAG, "Add a store member", { params: StoreParamsSchema, body: AddStoreMemberBodySchema }) });
  router.delete(`${STORES}/:id/members/:userId`, controller.removeMember, { ...seller, ...describeRoute(TAG, "Remove a store member", { params: StoreMemberParamsSchema }) });
  router.post(`/api/v1/admin/stores/:id/status`, controller.changeStatus, { ...admin, ...describeRoute(TAG, "Suspend or reinstate a store", { params: StoreParamsSchema, body: StoreStatusBodySchema }) });
  router.post(`/api/v1/admin/stores/:id/featured`, controller.changeFeatured, { ...admin, ...describeRoute(TAG, "Feature a store on the mart", { params: StoreParamsSchema, body: FeatureStoreBodySchema }) });
}

export function registerSellerApplicationRoutes(router: HttpRouter, controller: SellerApplicationsController, web: WebKit): void {
  const { guard } = web;
  router.post("/api/v1/seller/applications", controller.submit, { ...guard.requirePermission("seller:apply"), ...describeRoute(TAG, "Apply to open a store", { body: SubmitSellerApplicationBodySchema }) });
  router.get("/api/v1/seller/applications/me", controller.listMine, { ...guard.requirePermission("seller:apply"), ...describeRoute(TAG, "Get my latest seller application") });
  router.get("/api/v1/admin/seller-applications", controller.listForReview, {
    ...guard.requirePermission("seller-applications:review"),
    ...describeRoute(TAG, "List seller applications", { query: ListSellerApplicationsQuerySchema }),
  });
  router.post("/api/v1/admin/seller-applications/:id/review", controller.review, {
    ...guard.requirePermission("seller-applications:review"),
    ...describeRoute(TAG, "Approve or reject a seller application", { params: ApplicationParamsSchema, body: ReviewSellerApplicationBodySchema }),
  });
}
