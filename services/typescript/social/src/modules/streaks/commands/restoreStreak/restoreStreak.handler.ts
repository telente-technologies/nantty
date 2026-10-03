import { conflict, forbidden, unprocessable } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { findDirectPeerId, requireConversationMember } from "../../../conversations/services/conversationAccess.service.js";
import { streakRepository } from "../../repositories/streak.repository.js";
import { currentRestoreMonthKey, evaluateStreakAt, restoreBrokenStreak, restoresAllowedPerMonth, type StreakView } from "../../services/streakEngine.service.js";
import { buildStreakViewForViewer, loadStreakParticipants, snapshotFromRow } from "../../services/streakTracking.service.js";
import type { RestoreStreakCommand } from "./restoreStreak.command.js";

export function createRestoreStreakHandler(context: HandlerContext): Handler<RestoreStreakCommand, StreakView> {
  return async ({ viewerId, conversationId }) => {
    const db = context.database.client;
    const { conversation } = await requireConversationMember(db, conversationId, viewerId);
    const peerId = findDirectPeerId(conversation, viewerId);
    if (peerId === undefined) throw unprocessable("STREAKS_ARE_ONE_TO_ONE", "Streaks only exist in one-to-one chats.");
    const now = context.clock.now();
    const participants = await loadStreakParticipants(db, viewerId, peerId);
    const current = evaluateStreakAt(snapshotFromRow(await streakRepository.find(db, conversationId)), now, participants);
    if (current.state !== "broken" || current.restorableUntil === null) throw conflict("NOTHING_TO_RESTORE", "Nothing to restore");
    if (now > current.restorableUntil) throw conflict("RESTORE_WINDOW_PASSED", "The restore window has passed.");
    const monthKey = currentRestoreMonthKey(now, participants.viewerTimeZone);
    const allowed = restoresAllowedPerMonth(await context.premium.isPremium(viewerId));
    if ((await streakRepository.restoresUsedInMonth(db, viewerId, monthKey)) >= allowed) throw forbidden("NO_RESTORES_LEFT", "You have no streak restores left this month.");
    const restored = restoreBrokenStreak(current, now, participants);
    await context.database.transaction(async (transaction) => {
      await streakRepository.save(transaction, conversationId, restored);
      await streakRepository.recordRestore(transaction, conversationId, viewerId, monthKey, restored.count);
      await appendDomainEventsToOutbox(transaction, [{ eventType: socialEventTypes.streakRestored, subject: conversationId, occurredAt: now, data: { conversationId, restoredBy: viewerId, peerId, count: restored.count } }]);
    });
    return buildStreakViewForViewer(context, conversationId, viewerId, peerId);
  };
}
