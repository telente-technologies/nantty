import type { TicketStatus } from "../../../../enums/ticket.enum.js";

export interface ChangeTicketStatusCommand {
  readonly actor: { readonly id: string; readonly name: string };
  readonly ticketId: string;
  readonly status: TicketStatus;
  readonly reason: string | null;
}
