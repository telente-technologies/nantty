import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { UpdateContentPreferencesCommand } from "../commands/updateContentPreferences/updateContentPreferences.command.js";
import type { ContentPreferencesView } from "../models/contentPreferences.model.js";
import type { GetContentPreferencesQuery } from "../queries/getContentPreferences/getContentPreferences.query.js";
import { updateContentPreferencesBodySchema } from "../validators/contentPreferences.validator.js";

export interface ContentPreferencesHandlers {
  readonly getContentPreferences: Handler<GetContentPreferencesQuery, ContentPreferencesView>;
  readonly updateContentPreferences: Handler<UpdateContentPreferencesCommand, ContentPreferencesView>;
}

export function createContentPreferencesController(route: RouteFactory, handlers: ContentPreferencesHandlers) {
  return {
    get: route({ authentication: "required" }, ({ principal }) => handlers.getContentPreferences({ accountId: principal.accountId })),
    update: route({ authentication: "required", body: updateContentPreferencesBodySchema }, ({ principal, body }) =>
      handlers.updateContentPreferences({ accountId: principal.accountId, showSensitiveWithoutWarning: body.showSensitiveWithoutWarning })),
  };
}
