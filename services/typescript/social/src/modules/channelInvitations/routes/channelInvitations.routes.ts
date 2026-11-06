import type { HttpRouter } from "@nantty/fastify-platform";
import type { createChannelInvitationsController } from "../controllers/channelInvitations.controller.js";

export function registerChannelInvitationsRoutes(router: HttpRouter, controller: ReturnType<typeof createChannelInvitationsController>): void {
  router.post("/api/v1/channels/:channelId/invitation-links", controller.createLink);
  router.get("/api/v1/channels/:channelId/invitation-links", controller.listLinks);
  router.delete("/api/v1/channels/:channelId/invitation-links/:linkId", controller.revokeLink);
  router.get("/api/v1/channels/invitation-links/:token/preview", controller.previewLink);
  router.post("/api/v1/channels/invitation-links/:token/claim", controller.claimLink);
  router.get("/api/v1/channel-invitations", controller.listInvitations);
  router.post("/api/v1/channel-invitations/:invitationId/accept", controller.accept);
  router.post("/api/v1/channel-invitations/:invitationId/decline", controller.decline);
}
