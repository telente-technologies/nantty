import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { ConnectionEntry } from "../../models/follow.model.js";
import { listConnectionsRespectingPrivacy } from "../../services/connectionList.service.js";
import type { ListFollowersQuery } from "./listFollowers.query.js";

export function createListFollowersHandler(context: HandlerContext): Handler<ListFollowersQuery, Page<ConnectionEntry>> {
  return (query) => listConnectionsRespectingPrivacy(context, { ...query, direction: "followers" });
}
