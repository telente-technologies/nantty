import type { Handler } from "../../../../types/handlerContext.type.js";
import { rejectLegacyPlaintextEndpoint } from "../../services/liveLocation.service.js";
import type { ReactToMessageCommand } from "./reactToMessage.command.js";

export function createReactToMessageHandler(): Handler<ReactToMessageCommand, never> {
  return async () => rejectLegacyPlaintextEndpoint("reactions");
}
