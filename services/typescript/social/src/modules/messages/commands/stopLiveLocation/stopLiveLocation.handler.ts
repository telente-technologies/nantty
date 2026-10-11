import type { Handler } from "../../../../types/handlerContext.type.js";
import { rejectLegacyPlaintextEndpoint } from "../../services/liveLocation.service.js";
import type { StopLiveLocationCommand } from "./stopLiveLocation.command.js";

export function createStopLiveLocationHandler(): Handler<StopLiveLocationCommand, never> {
  return async () => rejectLegacyPlaintextEndpoint("liveLocation");
}
