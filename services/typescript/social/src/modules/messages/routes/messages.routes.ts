import type { HttpRouter } from "@zudojs/http";

import type { createMessagesController } from "../controllers/messages.controller.js";

export function registerMessagesRoutes(router: HttpRouter, controller: ReturnType<typeof createMessagesController>): void {
  router.get("/api/v1/conversations/:conversationId/messages", controller.list);
  router.post("/api/v1/conversations/:conversationId/messages", controller.send);
  router.post("/api/v1/messages/:messageId/reactions", controller.react);
  router.delete("/api/v1/messages/:messageId/reactions/:emoji", controller.unreact);
  router.patch("/api/v1/messages/:messageId/location", controller.updateLocation);
  router.post("/api/v1/messages/:messageId/live-location/stop", controller.stopLocation);
  router.post("/api/v1/messages/:messageId/poll-votes", controller.vote);
  router.post("/api/v1/stories/:storyId/replies", controller.replyToStory);
  router.post("/api/v1/chat/shares", controller.share);
  router.get("/api/v1/chat/content", controller.content);
}
