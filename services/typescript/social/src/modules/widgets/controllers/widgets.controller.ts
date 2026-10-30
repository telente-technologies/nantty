import type { HttpRouterContext } from "@nantty/fastify-platform";

import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { ListWidgetStoriesQuery } from "../queries/listWidgetStories/listWidgetStories.query.js";
import type { WidgetStoriesPayload } from "../services/widgetStoryOrdering.service.js";
import { WidgetResponseCache } from "../services/widgetResponseCache.service.js";

export interface WidgetsHandlers {
  readonly listWidgetStories: Handler<ListWidgetStoriesQuery, WidgetStoriesPayload>;
}

const storiesShownOnWidget = 8;

export function createWidgetsController(route: RouteFactory, handlers: WidgetsHandlers, cache = new WidgetResponseCache<WidgetStoriesPayload>()) {
  const stories = route({ authentication: "required" }, ({ principal }) =>
    cache.getOrLoad(principal.accountId, () => handlers.listWidgetStories({ viewerId: principal.accountId, limit: storiesShownOnWidget })));
  return {
    stories: async (context: HttpRouterContext) => {
      const response = await stories(context);
      if (response.status === 200) {
        response.setHeader("cache-control", "private, max-age=60");
        response.setHeader("vary", "Authorization");
      }
      return response;
    },
  };
}
