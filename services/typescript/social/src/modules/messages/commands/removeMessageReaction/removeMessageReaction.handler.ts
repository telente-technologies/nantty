import type { Handler } from "../../../../types/handlerContext.type.js";
import { rejectLegacyPlaintextEndpoint } from "../../services/liveLocation.service.js";
import type { RemoveMessageReactionCommand } from "./removeMessageReaction.command.js";

export function createRemoveMessageReactionHandler(): Handler<RemoveMessageReactionCommand, never> {
  return async () => rejectLegacyPlaintextEndpoint("reactions");
}
