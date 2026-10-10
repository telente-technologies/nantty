import type { HttpRouter } from "@zudojs/http";

import type { createPostsController } from "../controllers/posts.controller.js";

export function registerPostsRoutes(router: HttpRouter, controller: ReturnType<typeof createPostsController>): void {
  router.post("/api/v1/posts", controller.createPost);
  router.get("/api/v1/posts/:postId", controller.getPost);
  router.delete("/api/v1/posts/:postId", controller.deletePost);
  router.post("/api/v1/posts/:postId/impressions", controller.recordImpression);
  router.post("/api/v1/posts/:postId/profile-visits", controller.recordProfileVisit);
  router.get("/api/v1/posts/:postId/analytics", controller.analytics);
  router.post("/api/v1/posts/:postId/like", controller.likePost);
  router.delete("/api/v1/posts/:postId/like", controller.unlikePost);
  router.put("/api/v1/posts/:postId/pin", controller.pinPost);
  router.delete("/api/v1/posts/:postId/pin", controller.unpinPost);
  router.post("/api/v1/posts/:postId/share", controller.sharePost);
  router.post("/api/v1/posts/:postId/repost", controller.resharePost);
  router.get("/api/v1/users/:userId/posts", controller.listUserPosts);
  router.post("/api/v1/stories", controller.publishStory);
  router.get("/api/v1/stories/tray", controller.listStoryTray);
  router.post("/api/v1/stories/:storyId/seen", controller.markStorySeen);
  router.get("/api/v1/stories/:storyId/viewers", controller.listStoryViewers);
  router.get("/api/v1/users/:userId/stories", controller.listUserStories);
}
