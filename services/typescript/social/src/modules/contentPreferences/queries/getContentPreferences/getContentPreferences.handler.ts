import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { currentViewerAgeBracket } from "../../../../utils/viewerAgeContext.util.js";
import { resolveViewerContentPolicy } from "../../../posts/services/sensitiveContent.service.js";
import type { ContentPreferencesView } from "../../models/contentPreferences.model.js";
import type { GetContentPreferencesQuery } from "./getContentPreferences.query.js";

export function createGetContentPreferencesHandler(context: HandlerContext): Handler<GetContentPreferencesQuery, ContentPreferencesView> {
  return async ({ accountId }) => {
    const ageBracket = currentViewerAgeBracket();
    const policy = await resolveViewerContentPolicy(context, { viewerId: accountId, ageBracket });
    return { showSensitiveWithoutWarning: policy.showSensitiveWithoutWarning, canChangeSensitiveContentSetting: ageBracket === "adult", ageBracket };
  };
}
