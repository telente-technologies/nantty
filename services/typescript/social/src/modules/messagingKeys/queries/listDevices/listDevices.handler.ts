import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { UserDevicesView } from "../../models/messagingKeys.model.js";
import { deviceKeyRepository } from "../../repositories/deviceKey.repository.js";

export function createListDevicesHandler(context: HandlerContext): Handler<{ readonly userIds: readonly string[] }, { readonly data: UserDevicesView[] }> {
  return async ({ userIds }) => {
    const unique = [...new Set(userIds)];
    const rows = await deviceKeyRepository.listDevices(context.database.client, unique);
    return {
      data: unique.map((userId) => ({
        userId,
        devices: rows.filter((row) => row.accountId === userId).map((row) => ({ deviceId: row.deviceId, registrationId: row.registrationId, identityKey: row.identityKey })),
      })),
    };
  };
}
