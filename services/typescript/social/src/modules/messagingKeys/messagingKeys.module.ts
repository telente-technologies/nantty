import type { HttpRouter } from "@zudojs/http";

import type { HandlerContext } from "../../types/handlerContext.type.js";
import type { RouteFactory } from "../../utils/route.util.js";
import { createClaimPreKeyBundlesHandler } from "./commands/claimPreKeyBundles/claimPreKeyBundles.handler.js";
import { createRegisterDeviceHandler, createRotateSignedPreKeyHandler, createUploadOneTimePreKeysHandler } from "./commands/registerDevice/registerDevice.handler.js";
import { createAcknowledgeMailboxHandler, createDepositMailboxHandler, createReadMailboxHandler } from "./commands/keyMailbox/keyMailbox.handler.js";
import { createMessagingKeysController } from "./controllers/messagingKeys.controller.js";
import { createListDevicesHandler } from "./queries/listDevices/listDevices.handler.js";
import { deviceKeyRepository } from "./repositories/deviceKey.repository.js";
import { registerMessagingKeysRoutes } from "./routes/messagingKeys.routes.js";
import { loadDeviceKeyStatus } from "./services/deviceKeyStatus.service.js";

export function mountMessagingKeysModule(router: HttpRouter, route: RouteFactory, context: HandlerContext): void {
  registerMessagingKeysRoutes(router, createMessagingKeysController(route, {
    registerDevice: createRegisterDeviceHandler(context),
    uploadOneTimePreKeys: createUploadOneTimePreKeysHandler(context),
    rotateSignedPreKey: createRotateSignedPreKeyHandler(context),
    getDeviceStatus: ({ accountId, deviceId }) => loadDeviceKeyStatus(context.database.client, accountId, deviceId),
    removeDevice: async ({ accountId, deviceId }) => {
      await deviceKeyRepository.remove(context.database.client, accountId, deviceId);
    },
    listDevices: createListDevicesHandler(context),
    claimPreKeyBundles: createClaimPreKeyBundlesHandler(context),
    depositMailbox: createDepositMailboxHandler(context),
    readMailbox: createReadMailboxHandler(context),
    acknowledgeMailbox: createAcknowledgeMailboxHandler(context),
  }));
}
