import type { Logger } from "@nantty/fastify-platform";

import { socialEventTypes } from "../events/eventTypes.event.js";
import { appendDomainEventsToOutbox, deterministicDomainEventId, type DomainEventInput } from "../events/outbox.event.js";
import { hourglassThresholdSeconds } from "../constants/streak.constant.js";
import type { HandlerContext } from "../types/handlerContext.type.js";
import { daysBetweenLabels, localDayLabel, secondsUntilLocalDayEnds, isValidTimeZone } from "../utils/localDay.util.js";

const streakPageSize = 250;

interface ReminderCandidate {
  readonly conversationId: string;
  readonly accountId: string;
  readonly localDay: string;
  readonly count: number;
}

/**
 * Emits one reminder per direct-chat participant and local day. Stable outbox IDs
 * make retries and concurrent scheduler instances idempotent without another table.
 */
export async function runStreakExpiryReminders(context: HandlerContext, now = context.clock.now()): Promise<number> {
  const db = context.database.client;
  let cursor: string | undefined;
  let candidatesExamined = 0;
  for (;;) {
    const page = await db.chatStreak.findMany({
      where: {
        state: "active",
        count: { gt: 0 },
        lastCompletedDay: { not: null },
        conversation: { kind: "direct" },
      },
      orderBy: { conversationId: "asc" },
      take: streakPageSize,
      ...(cursor === undefined ? {} : { cursor: { conversationId: cursor }, skip: 1 }),
      include: { conversation: { include: { members: { where: { leftAt: null }, select: { accountId: true } } } } },
    });
    if (page.length === 0) break;
    cursor = page[page.length - 1]!.conversationId;
    candidatesExamined += page.length;

    const accountIds = [...new Set(page.flatMap((row) => row.conversation.members.map((member) => member.accountId)))];
    const settings = await db.chatSettings.findMany({ where: { accountId: { in: accountIds } }, select: { accountId: true, timezone: true, notifyStreakReminders: true } });
    const settingsByAccount = new Map(settings.map((row) => [row.accountId, row]));
    const candidates: ReminderCandidate[] = [];
    for (const row of page) {
      if (row.conversation.members.length !== 2 || row.lastCompletedDay === null) continue;
      for (const member of row.conversation.members) {
        const memberSettings = settingsByAccount.get(member.accountId);
        if (memberSettings?.notifyStreakReminders === false) continue;
        const zone = memberSettings?.timezone && isValidTimeZone(memberSettings.timezone) ? memberSettings.timezone : "UTC";
        const localDay = localDayLabel(now, zone);
        if (daysBetweenLabels(row.lastCompletedDay, localDay) !== 1) continue;
        if (secondsUntilLocalDayEnds(now, zone) > hourglassThresholdSeconds) continue;
        candidates.push({ conversationId: row.conversationId, accountId: member.accountId, localDay, count: row.count });
      }
    }

    const sentToday = candidates.length === 0 ? [] : await db.streakSenderDay.findMany({
      where: { OR: candidates.map(({ conversationId, accountId, localDay }) => ({ conversationId, accountId, localDay })) },
      select: { conversationId: true, accountId: true, localDay: true },
    });
    const alreadyMessaged = new Set(sentToday.map((row) => `${row.conversationId}:${row.accountId}:${row.localDay}`));
    const events: DomainEventInput[] = candidates
      .filter((candidate) => !alreadyMessaged.has(`${candidate.conversationId}:${candidate.accountId}:${candidate.localDay}`))
      .map((candidate) => ({
        id: deterministicDomainEventId(`${socialEventTypes.streakReminderDue}:${candidate.conversationId}:${candidate.accountId}:${candidate.localDay}`),
        eventType: socialEventTypes.streakReminderDue,
        subject: candidate.conversationId,
        occurredAt: now,
        data: { conversationId: candidate.conversationId, accountId: candidate.accountId, localDay: candidate.localDay, count: candidate.count } as DomainEventInput["data"],
      }));
    if (events.length > 0) {
      await context.database.transaction((transaction) => appendDomainEventsToOutbox(transaction, events));
    }
    if (page.length < streakPageSize) break;
  }
  return candidatesExamined;
}

export function startStreakExpiryReminderJob(context: HandlerContext, logger: Logger, intervalMs: number): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const tick = async () => {
    try {
      await runStreakExpiryReminders(context);
    } catch (error) {
      logger.warn("streak expiry reminder sweep failed", { error: error instanceof Error ? error.message : String(error) });
    }
    if (!stopped) timer = setTimeout(() => void tick(), intervalMs);
  };
  void tick();
  return () => {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
  };
}
