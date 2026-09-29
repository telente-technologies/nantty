import { CommandHandler } from "@zudojs/cqrs";

import { invalidState } from "../../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../../events/notificationRequested.event.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import type { SupportTicketMessageDto } from "../../dtos/support.dto.js";
import { MESSAGE_PREVIEW_LENGTH } from "../../models/support.model.js";
import type { SupportService } from "../../services/support.service.js";
import type { PostSupportTicketMessageCommand } from "./postSupportTicketMessage.command.js";

export class PostSupportTicketMessageHandler extends CommandHandler<PostSupportTicketMessageCommand, SupportTicketMessageDto> {
  public readonly commandType = "support.postSupportTicketMessage" as const;

  public constructor(private readonly supportService: SupportService) {
    super();
  }

  public async execute(command: PostSupportTicketMessageCommand): Promise<SupportTicketMessageDto> {
    const { tickets, audit, events, clock } = this.supportService.dependencies;
    const authorId = command.principal.userId;
    const ticket = await this.supportService.requireTicketForViewer(command.ticketId, command.principal, command.asAgent);
    if (ticket.status === "closed") throw invalidState("This ticket is closed. Open a new ticket instead.");
    const attachmentMediaIds = [...new Set(command.input.attachmentMediaIds ?? [])];
    await this.supportService.assertAttachmentsBelongTo(attachmentMediaIds, authorId);
    const text = command.input.text.trim();
    const message = await tickets.appendMessage(
      { ticketId: ticket.id, authorId, fromSupport: command.asAgent, text, attachmentMediaIds },
      {
        status: command.asAgent ? "awaiting_you" : "open",
        lastMessagePreview: text.slice(0, MESSAGE_PREVIEW_LENGTH),
        ...(command.asAgent && ticket.assigneeId === null ? { assigneeId: authorId } : {}),
      },
      clock.now(),
    );
    await audit.record({ actorId: authorId, action: command.asAgent ? "support.agent_replied" : "support.customer_replied", entityType: "support_ticket", entityId: ticket.id });
    if (command.asAgent) {
      await publishEvent(events, NotificationRequestedEvent, {
        userId: ticket.requesterId,
        category: "social",
        title: "Zudomart Support replied",
        body: text.slice(0, 80),
        data: { ticketId: ticket.id, kind: "support" },
      });
    } else {
      await this.supportService.notifySupportTeamSafely(`Customer replied: ${ticket.subject}`, `Ticket: ${ticket.id}\n\n${text}`, "support_ticket");
    }
    const [dto] = await this.supportService.presentMessages([message], authorId);
    if (dto === undefined) throw invalidState("The message could not be shown.");
    return dto;
  }
}
