import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { StoreFollowState } from "../../models/storeFollow.model.js";
import { storeFollowRepository } from "../../repositories/storeFollow.repository.js";
import type { GetStoreFollowStatusQuery } from "./getStoreFollowStatus.query.js";

export function createGetStoreFollowStatusHandler(context: HandlerContext): Handler<GetStoreFollowStatusQuery, StoreFollowState> {
  return async ({ viewerId, storeId }) => {
    const db = context.database.client;
    const [isFollowing, followers] = await Promise.all([viewerId === undefined ? false : storeFollowRepository.isFollowing(db, viewerId, storeId), storeFollowRepository.countFollowers(db, storeId)]);
    return { storeId, isFollowing, followers };
  };
}
