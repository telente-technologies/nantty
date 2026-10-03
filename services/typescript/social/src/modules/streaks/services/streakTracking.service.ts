import { socialEventTypes } from "../../../events/eventTypes.event.js";
import type { DomainEventInput } from "../../../events/outbox.event.js";
import type { Db } from "../../../types/database.type.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { localDayLabel } from "../../../utils/localDay.util.js";
import { chatSettingsRepository } from "../../chatSettings/repositories/chatSettings.repository.js";
import { streakRepository } from "../repositories/streak.repository.js";
import {
  buildStreakView, completeStreakDay, currentRestoreMonthKey, emptyStreak, evaluateStreakAt,
  type StreakParticipants, type StreakSnapshot, type StreakView,
} from "./streakEngine.service.js";

export async function loadStreakParticipants(db: Db, viewerId: string, peerId: string): Promise<StreakParticipants> {
  const rows = await chatSettingsRepository.findMany(db, [viewerId, peerId]);
  const zone = (accountId: string) => rows.find((row) => row.accountId === accountId)?.timezone ?? "UTC";
  return { viewerTimeZone: zone(viewerId), peerTimeZone: zone(peerId) };
}

export function snapshotFromRow(row: { count: number; state: StreakSnapshot["state"]; lastCompletedDay: string | null; countBeforeBreak: number; brokenAt: Date | null; restorableUntil: Date | null } | null): StreakSnapshot {
  return row === null ? emptyStreak : { count: row.count, state: row.state, lastCompletedDay: row.lastCompletedDay, countBeforeBreak: row.countBeforeBreak, brokenAt: row.brokenAt, restorableUntil: row.restorableUntil };
}

export async function recordDirectSendForStreak(db: Db, conversationId: string, senderId: string, peerId: string, now: Date): Promise<DomainEventInput[]> {
  const participants = await loadStreakParticipants(db, senderId, peerId);
  const senderDay = localDayLabel(now, participants.viewerTimeZone);
  await streakRepository.recordSenderDay(db, conversationId, senderId, senderDay);
  if (!(await streakRepository.sentOnDay(db, conversationId, peerId, senderDay))) return [];
  const current = snapshotFromRow(await streakRepository.find(db, conversationId));
  const { snapshot, milestoneReached } = completeStreakDay(current, senderDay, now, participants);
  await streakRepository.save(db, conversationId, snapshot);
  if (milestoneReached === null) return [];
  await streakRepository.addCelebrations(db, conversationId, [senderId, peerId], milestoneReached);
  return [{ eventType: socialEventTypes.streakMilestoneReached, subject: conversationId, occurredAt: now, data: { conversationId, accountIds: [senderId, peerId], days: milestoneReached } }];
}

export async function buildStreakViewForViewer(context: HandlerContext, conversationId: string, viewerId: string, peerId: string): Promise<StreakView> {
  const db = context.database.client;
  const now = context.clock.now();
  const participants = await loadStreakParticipants(db, viewerId, peerId);
  const [row, pending, isPremium] = await Promise.all([
    streakRepository.find(db, conversationId),
    streakRepository.pendingCelebration(db, conversationId, viewerId),
    context.premium.isPremium(viewerId),
  ]);
  const snapshot = evaluateStreakAt(snapshotFromRow(row), now, participants);
  const myToday = localDayLabel(now, participants.viewerTimeZone);
  const peerToday = localDayLabel(now, participants.peerTimeZone);
  const [viewerSentToday, peerSentToday, used] = await Promise.all([
    streakRepository.sentOnDay(db, conversationId, viewerId, myToday),
    streakRepository.sentOnDay(db, conversationId, peerId, peerToday),
    streakRepository.restoresUsedInMonth(db, viewerId, currentRestoreMonthKey(now, participants.viewerTimeZone)),
  ]);
  return buildStreakView({ snapshot, now, participants, viewerSentToday, peerSentToday, restoresUsedThisMonth: used, viewerIsPremium: isPremium, pendingCelebrationDays: pending?.days ?? null });
}
