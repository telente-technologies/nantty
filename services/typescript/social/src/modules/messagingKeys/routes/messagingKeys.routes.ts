import type { HttpRouter } from "@zudojs/http";

import type { createMessagingKeysController } from "../controllers/messagingKeys.controller.js";

export function registerMessagingKeysRoutes(router: HttpRouter, controller: ReturnType<typeof createMessagingKeysController>): void {
  router.post("/api/v1/chat/keys/devices/query", controller.listDevices);
  router.post("/api/v1/chat/keys/bundles", controller.claimBundles);
  router.post("/api/v1/chat/keys/mailbox", controller.depositMailbox);
  router.get("/api/v1/chat/keys/devices/:deviceId/mailbox", controller.readMailbox);
  router.post("/api/v1/chat/keys/devices/:deviceId/mailbox/ack", controller.acknowledgeMailbox);
  router.put("/api/v1/chat/keys/devices/:deviceId", controller.register);
  router.get("/api/v1/chat/keys/devices/:deviceId", controller.status);
  router.delete("/api/v1/chat/keys/devices/:deviceId", controller.remove);
  router.post("/api/v1/chat/keys/devices/:deviceId/prekeys", controller.uploadOneTimePreKeys);
  router.put("/api/v1/chat/keys/devices/:deviceId/signed-prekey", controller.rotateSignedPreKey);
}
