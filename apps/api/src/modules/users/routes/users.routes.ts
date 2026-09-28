import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { UsersController } from "../controllers/users.controller.js";
import {
  AddressBodySchema,
  IdParamsSchema,
  SaveTopicsBodySchema,
  UpdateAddressBodySchema,
  UpdateProfileBodySchema,
  UpdateSettingsBodySchema,
  UsernameParamsSchema,
} from "../validators/users.validator.js";

const ME = "/api/v1/users/me";
const TAG = "users";

export function registerUsersRoutes(router: HttpRouter, controller: UsersController, web: WebKit): void {
  const { guard } = web;
  const profile = guard.requirePermission("profile:manage");

  router.get(ME, controller.getMe, { ...profile, ...describeRoute(TAG, "Get my profile") });
  router.patch(ME, controller.updateMe, { ...profile, ...describeRoute(TAG, "Update my profile", { body: UpdateProfileBodySchema }) });
  router.get(`${ME}/settings`, controller.getSettings, { ...profile, ...describeRoute(TAG, "Get my settings") });
  router.patch(`${ME}/settings`, controller.updateSettings, { ...profile, ...describeRoute(TAG, "Update my settings", { body: UpdateSettingsBodySchema }) });
  router.post(`${ME}/deactivate`, controller.deactivate, { ...profile, ...describeRoute(TAG, "Deactivate my account") });
  router.get(`${ME}/topics`, controller.listMyTopics, { ...profile, ...describeRoute(TAG, "List my selected topics") });
  router.put(`${ME}/topics`, controller.saveMyTopics, { ...profile, ...describeRoute(TAG, "Save my topics (at least 3)", { body: SaveTopicsBodySchema }) });
  router.get(`${ME}/addresses`, controller.listAddresses, { ...profile, ...describeRoute(TAG, "List my shipping addresses") });
  router.post(`${ME}/addresses`, controller.addAddress, { ...profile, ...describeRoute(TAG, "Add a shipping address", { body: AddressBodySchema }) });
  router.patch(`${ME}/addresses/:id`, controller.updateAddress, { ...profile, ...describeRoute(TAG, "Update a shipping address", { params: IdParamsSchema, body: UpdateAddressBodySchema }) });
  router.delete(`${ME}/addresses/:id`, controller.removeAddress, { ...profile, ...describeRoute(TAG, "Delete a shipping address", { params: IdParamsSchema }) });
  router.get("/api/v1/topics", controller.listTopics, { ...guard.allowAnyone(), ...describeRoute(TAG, "List personalisation topics") });
  router.get("/api/v1/users/username/:username", controller.getUserByUsername, { ...guard.allowAnyone(), ...describeRoute(TAG, "Get a public profile by username", { params: UsernameParamsSchema }) });
  router.get("/api/v1/users/:id", controller.getUserById, { ...guard.allowAnyone(), ...describeRoute(TAG, "Get a public profile", { params: IdParamsSchema }) });
}
