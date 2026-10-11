import type { Handler } from "../../../../types/handlerContext.type.js";
import { rejectLegacyPlaintextEndpoint } from "../../services/liveLocation.service.js";
import type { UpdateLiveLocationCommand } from "./updateLiveLocation.command.js";

export function createUpdateLiveLocationHandler(): Handler<UpdateLiveLocationCommand, never> {
  return async () => rejectLegacyPlaintextEndpoint("liveLocation");
}
