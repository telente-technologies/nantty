import type { HttpRouter } from "@zudojs/http";

import type { createFollowsController } from "../controllers/follows.controller.js";

export function registerFollowsRoutes(router: HttpRouter, controller: ReturnType<typeof createFollowsController>): void {
  router.post("/api/v1/users/:userId/follow", controller.followUser);
  router.delete("/api/v1/users/:userId/follow", controller.unfollowUser);
  router.get("/api/v1/users/:userId/followers", controller.listFollowers);
  router.get("/api/v1/users/:userId/following", controller.listFollowing);
  router.get("/api/v1/users/:userId/follow-status", controller.getFollowStatus);
  router.get("/api/v1/users/:userId/connections", controller.listConnections);
  router.get("/api/v1/users/me/follow-requests", controller.listFollowRequests);
  router.post("/api/v1/follow-requests/:requestId/accept", controller.acceptFollowRequest);
  router.post("/api/v1/follow-requests/:requestId/reject", controller.rejectFollowRequest);
}
