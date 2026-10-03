import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { ConnectionEntry } from "../../models/follow.model.js";
import { listConnectionsRespectingPrivacy } from "../../services/connectionList.service.js";
import type { ListFollowingQuery } from "./listFollowing.query.js";

export function createListFollowingHandler(context: HandlerContext): Handler<ListFollowingQuery, Page<ConnectionEntry>> {
  return (query) => listConnectionsRespectingPrivacy(context, { ...query, direction: "following" });
}
