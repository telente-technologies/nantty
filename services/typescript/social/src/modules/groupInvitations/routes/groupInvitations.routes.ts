import type { HttpRouter } from "@nantty/fastify-platform";
import type { createGroupInvitationsController } from "../controllers/groupInvitations.controller.js";

export function registerGroupInvitationsRoutes(router: HttpRouter, controller: ReturnType<typeof createGroupInvitationsController>): void {
  router.post("/api/v1/conversations/:conversationId/invitations", controller.create);
  router.get("/api/v1/group-invitations", controller.list);
  router.post("/api/v1/group-invitations/:invitationId/accept", controller.accept);
  router.post("/api/v1/group-invitations/:invitationId/decline", controller.decline);
  router.delete("/api/v1/conversations/:conversationId/invitations/:invitationId", controller.revoke);
  router.post("/api/v1/conversations/:conversationId/invitation-links", controller.createLink);
  router.get("/api/v1/conversations/:conversationId/invitation-links", controller.listLinks);
  router.get("/api/v1/conversations/invitation-links/:token/preview", controller.previewLink);
  router.post("/api/v1/conversations/invitation-links/:token/claim", controller.claimLink);
  router.delete("/api/v1/conversations/:conversationId/invitation-links/:linkId", controller.revokeLink);
}
