import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { SharedContentCard } from "../../models/message.model.js";
import { buildSharedContentCard } from "../../services/sharedContentCard.service.js";
import type { GetSharedContentCardQuery } from "./getSharedContentCard.query.js";

export function createGetSharedContentCardHandler(context: HandlerContext): Handler<GetSharedContentCardQuery, SharedContentCard> {
  return ({ viewerId, reference }) => buildSharedContentCard(context, viewerId, reference);
}
