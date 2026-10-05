import { forbidden } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { createListBlockedUsersHandler } from "../../../blocks/queries/listBlockedUsers/listBlockedUsers.handler.js";
import { resolveViewerCountry } from "../../../explore/services/exploreScope.service.js";
import { suggestAccountsToFollow } from "../../../explore/services/whoToFollow.service.js";
import type { ConnectionEntry } from "../../models/follow.model.js";
import { buildConnectionEntries } from "../../services/connectionEntry.service.js";
import { listConnectionsRespectingPrivacy } from "../../services/connectionList.service.js";
import type { ListConnectionsQuery } from "./listConnections.query.js";

const ownerOnlyTabs = new Set(["shopped", "suggested", "blocked"]);

export function createListConnectionsHandler(context: HandlerContext): Handler<ListConnectionsQuery, Page<ConnectionEntry>> {
  const listBlocked = createListBlockedUsersHandler(context);
  return async (query) => {
    if (query.tab === "followers" || query.tab === "following") return listConnectionsRespectingPrivacy(context, { ...query, direction: query.tab });
    if (ownerOnlyTabs.has(query.tab) && (query.viewerId === undefined || query.viewerId !== query.ownerId)) throw forbidden("CONNECTIONS_PRIVATE", "Only you can see this list.");
    const viewerId = query.viewerId as string;
    if (query.tab === "blocked") return listBlocked({ viewerId, cursor: query.cursor, limit: query.limit });
    if (query.tab === "suggested") {
      const suggestions = await suggestAccountsToFollow(context, { viewerId, country: await resolveViewerCountry(context, viewerId, undefined), limit: Math.min(query.limit, 30) });
      return { data: await buildConnectionEntries(context, viewerId, suggestions.map((suggestion) => suggestion.user.id)), nextCursor: null };
    }
    return { data: [], nextCursor: null };
  };
}
