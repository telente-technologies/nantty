import type { HttpRouter } from "@zudojs/http";

import type { createCommentsController } from "../controllers/comments.controller.js";

export function registerCommentsRoutes(router: HttpRouter, controller: ReturnType<typeof createCommentsController>): void {
  router.get("/api/v1/posts/:postId/comments", controller.listPostComments);
  router.post("/api/v1/posts/:postId/comments", controller.createComment);
  router.get("/api/v1/posts/:postId/thread", controller.getPostConversation);
  router.get("/api/v1/comments/:commentId", controller.getComment);
  router.get("/api/v1/comments/:commentId/replies", controller.listCommentReplies);
  router.get("/api/v1/comments/:commentId/thread", controller.getCommentThread);
  router.delete("/api/v1/comments/:commentId", controller.deleteComment);
  router.post("/api/v1/comments/:commentId/like", controller.likeComment);
  router.delete("/api/v1/comments/:commentId/like", controller.unlikeComment);
}
