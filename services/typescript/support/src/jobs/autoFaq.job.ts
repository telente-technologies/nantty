import type { Logger } from "@nantty/fastify-platform";

import { autoFaqBatchSize, autoFaqLockMilliseconds } from "../constants/support.constant.js";
import type { AutoFaqStatus } from "../enums/ticket.enum.js";
import type { Clock } from "../interfaces/clock.interface.js";
import type { TicketStore } from "../interfaces/ticketStore.interface.js";
import type { AutoFaqOutcome, AutoFaqPublisher } from "../modules/autoFaq/services/autoFaqPublisher.service.js";

const ticketStatusByAction: Readonly<Record<AutoFaqOutcome["action"], AutoFaqStatus>> = { created: "published", appended: "appended", pending_review: "pending_review", skipped: "skipped" };

export async function processQueuedAutoFaqTickets(store: TicketStore, publisher: AutoFaqPublisher, clock: Clock, logger: Logger): Promise<number> {
  const tickets = await store.claimTicketsQueuedForAutoFaq(autoFaqBatchSize, clock.now(), autoFaqLockMilliseconds);
  for (const ticket of tickets) {
    try {
      const outcome = await publisher.publishFromResolvedTicket(ticket);
      await store.setAutoFaqStatus(ticket.id, ticketStatusByAction[outcome.action]);
    } catch (error) {
      logger.warn("auto-FAQ generation failed; it will be retried", { ticketId: ticket.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return tickets.length;
}
