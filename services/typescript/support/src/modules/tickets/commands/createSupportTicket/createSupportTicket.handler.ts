import { defaultPriorityByCategory } from "../../../../constants/ticketSla.constant.js";
import type { TicketWithThread } from "../../../../types/ticket.type.js";
import type { TicketModuleDependencies } from "../../tickets.module.js";
import { validateAttachmentUrls } from "../../services/attachmentPolicy.service.js";
import { ticketCreatedEvent } from "../../services/ticketEvents.service.js";
import { calculateSlaDueDates } from "../../services/ticketSla.service.js";
import type { CreateSupportTicketCommand } from "./createSupportTicket.command.js";

export async function handleCreateSupportTicket(dependencies: TicketModuleDependencies, command: CreateSupportTicketCommand): Promise<TicketWithThread> {
  if (command.idempotencyKey !== null) {
    const replay = await dependencies.store.findTicketByIdempotencyKey(command.accountId, command.idempotencyKey);
    if (replay !== null) return replay;
  }
  const attachments = validateAttachmentUrls(command.attachmentUrls, dependencies.mediaPublicBaseUrls);
  const profile = await dependencies.identity.findRequesterProfile(command.accountId);
  const now = dependencies.clock.now();
  const priority = defaultPriorityByCategory[command.category];
  const requesterName = profile?.displayName ?? "Zudomart member";
  return dependencies.store.createTicket(
    {
      requesterAccountId: command.accountId, requesterName, requesterUsername: profile?.username ?? "", subject: command.subject.trim(), category: command.category, priority,
      channel: command.channel, linkedReference: command.linkedReference, ...calculateSlaDueDates(priority, now), idempotencyKey: command.idempotencyKey,
    },
    { authorKind: "customer", authorId: command.accountId, authorName: requesterName, body: command.message.trim(), attachments },
    (created) => [ticketCreatedEvent(created, now)],
  );
}
