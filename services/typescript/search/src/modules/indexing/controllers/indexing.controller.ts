import type { HttpRouterContext } from "@zudojs/http";

import { PoisonEventError, SearchError } from "../../../errors/search.error.js";
import { assertInternalToken } from "../../../middlewares/principal.middleware.js";
import { errorToResponse, json, parseJsonBody } from "../../../utils/http.util.js";
import type { SearchEventProcessor } from "../services/searchEventProcessor.service.js";

export function createIndexingController(processor: SearchEventProcessor, internalToken: string) {
  return {
    ingestEvent: async (context: HttpRouterContext) => {
      try {
        assertInternalToken(context, internalToken);
        const body = parseJsonBody(context.request.body);
        const outcome = await processor.processBody(JSON.stringify(body ?? null));
        return json(200, { outcome });
      } catch (error) {
        if (error instanceof PoisonEventError) return json(400, { message: error.message, code: "INVALID_EVENT" });
        if (error instanceof SearchError) return errorToResponse(error) ?? json(500, { message: "Internal Server Error", code: "INTERNAL_ERROR" });
        throw error;
      }
    },
    listHandledEventTypes: async (context: HttpRouterContext) => {
      try {
        assertInternalToken(context, internalToken);
        return json(200, { data: processor.eventTypes });
      } catch (error) {
        return errorToResponse(error) ?? json(500, { message: "Internal Server Error", code: "INTERNAL_ERROR" });
      }
    },
  };
}
