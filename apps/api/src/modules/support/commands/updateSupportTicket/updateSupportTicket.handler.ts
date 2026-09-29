import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { convertTicketToSummary, type SupportTicketSummaryDto } from "../../dtos/support.dto.js";
import type { SupportService } from "../../services/support.service.js";
import type { UpdateSupportTicketCommand } from "./updateSupportTicket.command.js";

export class UpdateSupportTicketHandler extends CommandHandler<UpdateSupportTicketCommand, SupportTicketSummaryDto> {
  public readonly commandType = "support.updateSupportTicket" as const;

  public constructor(private readonly supportService: SupportService) {
    super();
  }

  public async execute(command: UpdateSupportTicketCommand): Promise<SupportTicketSummaryDto> {
    const { tickets, audit, clock } = this.supportService.dependencies;
    const ticket = await this.supportService.requireTicketForViewer(command.ticketId, command.principal, true);
    const { status, assigneeId } = command.input;
    const updated = await tickets.updateTicket(ticket.id, { ...(status === undefined ? {} : { status }), ...(assigneeId === undefined ? {} : { assigneeId }) }, clock.now());
    if (updated === undefined) throw notFound("Support ticket");
    await audit.record({
      actorId: command.principal.userId,
      action: "support.ticket_updated",
      entityType: "support_ticket",
      entityId: ticket.id,
      metadata: { from: ticket.status, to: updated.status, assigneeId: updated.assigneeId },
    });
    return convertTicketToSummary(updated);
  }
}
