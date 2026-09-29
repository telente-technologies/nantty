import { CommandHandler } from "@zudojs/cqrs";

import type { SupportTicketDetailDto } from "../../dtos/support.dto.js";
import type { SupportService } from "../../services/support.service.js";
import type { CreateSupportTicketCommand } from "./createSupportTicket.command.js";

export class CreateSupportTicketHandler extends CommandHandler<CreateSupportTicketCommand, SupportTicketDetailDto> {
  public readonly commandType = "support.createSupportTicket" as const;

  public constructor(private readonly supportService: SupportService) {
    super();
  }

  public async execute(command: CreateSupportTicketCommand): Promise<SupportTicketDetailDto> {
    const { tickets, userDirectory, audit, clock } = this.supportService.dependencies;
    const requesterId = command.principal.userId;
    const attachmentMediaIds = [...new Set(command.input.attachmentMediaIds ?? [])];
    await this.supportService.assertAttachmentsBelongTo(attachmentMediaIds, requesterId);
    const subject = command.input.subject.trim();
    const text = command.input.message.trim();
    const ticket = await tickets.createTicket(
      { requesterId, category: command.input.category, subject },
      { authorId: requesterId, fromSupport: false, text, attachmentMediaIds },
      clock.now(),
    );
    await audit.record({ actorId: requesterId, action: "support.ticket_created", entityType: "support_ticket", entityId: ticket.id, metadata: { category: ticket.category } });
    const [requester] = await userDirectory.findUserSummaries([requesterId]);
    await this.supportService.notifySupportTeamSafely(
      `New ticket: ${subject}`,
      `Category: ${ticket.category}\nTicket: ${ticket.id}\nFrom: @${requester?.username ?? requesterId}\n\n${text}`,
      "support_ticket",
    );
    return this.supportService.presentTicket(ticket, requesterId);
  }
}
