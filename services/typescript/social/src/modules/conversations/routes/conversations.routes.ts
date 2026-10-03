import type { HttpRouter } from "@zudojs/http";

import type { createConversationsController } from "../controllers/conversations.controller.js";

export function registerConversationsRoutes(router: HttpRouter, controller: ReturnType<typeof createConversationsController>): void {
  const base = "/api/v1/conversations";
  router.get(base, controller.list);
  router.post(base, controller.start);
  router.get(`${base}/search`, controller.search);
  router.post(`${base}/groups`, controller.createGroup);
  router.get(`${base}/:conversationId`, controller.get);
  router.patch(`${base}/:conversationId`, controller.update);
  router.delete(`${base}/:conversationId`, controller.remove);
  router.post(`${base}/:conversationId/accept`, controller.accept);
  router.post(`${base}/:conversationId/block`, controller.block);
  router.post(`${base}/:conversationId/not-spam`, controller.notSpam);
  router.post(`${base}/:conversationId/restrict`, controller.restrict);
  router.put(`${base}/:conversationId/mute`, controller.mute);
  router.post(`${base}/:conversationId/read`, controller.read);
  router.post(`${base}/:conversationId/leave`, controller.leave);
  router.get(`${base}/:conversationId/members`, controller.members);
  router.post(`${base}/:conversationId/members`, controller.addMembers);
  router.delete(`${base}/:conversationId/members/:userId`, controller.removeMember);
  router.post(`${base}/:conversationId/admins`, controller.grantAdmin);
  router.delete(`${base}/:conversationId/admins/:userId`, controller.revokeAdmin);
}
