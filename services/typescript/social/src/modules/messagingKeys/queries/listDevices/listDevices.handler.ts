import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { UserDevicesView } from "../../models/messagingKeys.model.js";
import { conversationRepository } from "../../../conversations/repositories/conversation.repository.js";
import { deviceKeyRepository } from "../../repositories/deviceKey.repository.js";

export function createListDevicesHandler(context: HandlerContext): Handler<{ readonly requesterId: string; readonly userIds: readonly string[] }, { readonly data: UserDevicesView[] }> {
  return async ({ requesterId, userIds }) => {
    const unique = [...new Set(userIds)];
    const allowed = new Set([requesterId, ...(await conversationRepository.peerAccountIds(context.database.client, requesterId))]);
    const visible = unique.filter((userId) => allowed.has(userId));
    const rows = await deviceKeyRepository.listDevices(context.database.client, visible);
    return {
      data: unique.map((userId) => ({
        userId,
        devices: rows.filter((row) => row.accountId === userId).map((row) => ({ deviceId: row.deviceId, registrationId: row.registrationId, identityKey: row.identityKey })),
      })),
    };
  };
}
