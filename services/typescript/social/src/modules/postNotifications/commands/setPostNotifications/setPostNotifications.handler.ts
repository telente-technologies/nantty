import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import type { PostNotificationsView } from "../../models/postNotifications.model.js";
import { assertCanChangePostNotifications } from "../../services/postNotificationRules.service.js";
import type { SetPostNotificationsCommand } from "./setPostNotifications.command.js";

export function createSetPostNotificationsHandler(context: HandlerContext): Handler<SetPostNotificationsCommand, PostNotificationsView> {
  return async ({ followerId, targetId, level }) => {
    const db = context.database.client;
    if (followerId !== targetId && !(await context.directory.findUserSummaries([targetId])).has(targetId)) throw notFound("USER_NOT_FOUND", "User not found.");
    const [follow, blockedEitherWay] = await Promise.all([followRepository.find(db, followerId, targetId), blockRepository.eitherDirection(db, followerId, targetId)]);
    assertCanChangePostNotifications({ isSelf: followerId === targetId, blockedEitherWay, followState: follow?.state });
    if (follow === null) throw notFound("USER_NOT_FOUND", "User not found.");
    if (follow.postNotifications !== level) await followRepository.setPostNotifications(db, follow.id, level);
    return { level, following: true };
  };
}
