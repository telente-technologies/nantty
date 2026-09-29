import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { FollowsController } from "../controllers/follows.controller.js";
import { ConnectionsQuerySchema, FollowListQuerySchema, SearchPeopleQuerySchema, TargetParamsSchema } from "../validators/follows.validator.js";

const TAG = "follows";
const USERS = "/api/v1/users/:id";
const STORES = "/api/v1/stores/:id";

export function registerFollowsRoutes(router: HttpRouter, controller: FollowsController, web: WebKit): void {
  const { guard } = web;
  const socialWrite = guard.requirePermission("social:write");
  const anyone = guard.allowAnyone();
  const params = { params: TargetParamsSchema };
  const listing = { params: TargetParamsSchema, query: FollowListQuerySchema };

  router.post(`${USERS}/follow`, controller.followUser, { ...socialWrite, ...describeRoute(TAG, "Follow a user", params) });
  router.delete(`${USERS}/follow`, controller.unfollowUser, { ...socialWrite, ...describeRoute(TAG, "Unfollow a user", params) });
  router.post(`${STORES}/follow`, controller.followStore, { ...socialWrite, ...describeRoute(TAG, "Follow a store", params) });
  router.delete(`${STORES}/follow`, controller.unfollowStore, { ...socialWrite, ...describeRoute(TAG, "Unfollow a store", params) });
  router.get(`${USERS}/followers`, controller.listUserFollowers, { ...anyone, ...describeRoute(TAG, "List a user's followers", listing) });
  router.get(`${USERS}/following`, controller.listFollowing, { ...anyone, ...describeRoute(TAG, "List who a user follows (type=user|store)", listing) });
  router.get(`${USERS}/follow-status`, controller.getUserFollowStatus, { ...anyone, ...describeRoute(TAG, "Follow status and counts for a user", params) });
  router.get(`${STORES}/followers`, controller.listStoreFollowers, { ...anyone, ...describeRoute(TAG, "List a store's followers", listing) });
  router.get(`${STORES}/follow-status`, controller.getStoreFollowStatus, { ...anyone, ...describeRoute(TAG, "Follow status and counts for a store", params) });
  router.post(`${USERS}/block`, controller.blockUser, { ...socialWrite, ...describeRoute(TAG, "Block a user", params) });
  router.delete(`${USERS}/block`, controller.unblockUser, { ...socialWrite, ...describeRoute(TAG, "Unblock a user", params) });
  router.get(`${USERS}/connections`, controller.listConnections, { ...guard.requirePermission("social:write"), ...describeRoute("follows", "Followers, following, shopped, suggested or blocked", { params: TargetParamsSchema, query: ConnectionsQuerySchema }) });
  router.get("/api/v1/search/people", controller.searchPeople, { ...guard.allowAnyone(), ...describeRoute("follows", "Search people to follow", { query: SearchPeopleQuerySchema }) });
  router.get("/api/v1/users/me/blocked", controller.listBlockedUsers, { ...guard.requirePermission("profile:manage"), ...describeRoute(TAG, "List users I have blocked", { query: FollowListQuerySchema }) });
}
