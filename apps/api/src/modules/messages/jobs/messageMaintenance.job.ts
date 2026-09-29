import type { ScheduledJob } from "../../../jobs/scheduledJobs.job.js";
import type { MessagesService } from "../services/messages.service.js";
import type { RealtimeTicketService } from "../services/realtimeTickets.service.js";

const PURGE_BATCH_SIZE = 500;
const MAXIMUM_BATCHES_PER_RUN = 20;

export async function purgeExpiredMessages(messagesService: MessagesService): Promise<number> {
  const { messages, clock } = messagesService.dependencies;
  let purged = 0;
  for (let batch = 0; batch < MAXIMUM_BATCHES_PER_RUN; batch += 1) {
    const deleted = await messages.deleteExpiredMessages(clock.now(), PURGE_BATCH_SIZE);
    purged += deleted;
    if (deleted < PURGE_BATCH_SIZE) break;
  }
  return purged;
}

export function createDisappearingMessagesPurgeJob(messagesService: MessagesService): ScheduledJob {
  return { id: "messages.purgeExpiredMessages", every: "1m", run: async () => void (await purgeExpiredMessages(messagesService)) };
}

export function createRealtimeTicketCleanupJob(tickets: RealtimeTicketService): ScheduledJob {
  return { id: "messages.deleteExpiredRealtimeTickets", every: "10m", run: async () => void (await tickets.deleteExpiredTickets()) };
}
