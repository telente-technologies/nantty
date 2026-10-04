import type { TicketStatus } from "../../../../enums/ticket.enum.js";
import type { StaffPrincipal } from "../../../../middlewares/staffAuth.middleware.js";

export interface PostStaffReplyCommand {
  readonly staff: StaffPrincipal;
  readonly ticketId: string;
  readonly body: string;
  readonly isInternalNote: boolean;
  readonly statusAfterReply: TicketStatus | undefined;
}
