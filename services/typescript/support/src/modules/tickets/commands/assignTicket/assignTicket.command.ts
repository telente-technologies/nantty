import type { StaffPrincipal } from "../../../../middlewares/staffAuth.middleware.js";

export interface AssignTicketCommand {
  readonly staff: StaffPrincipal;
  readonly canAssignOthers: boolean;
  readonly ticketId: string;
  readonly assigneeId: string | null;
  readonly reason: string | null;
}
