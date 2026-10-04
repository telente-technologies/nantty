import type { TicketCategory, TicketChannel } from "../../../../enums/ticket.enum.js";
import type { LinkedReference } from "../../../../types/ticket.type.js";

export interface CreateSupportTicketCommand {
  readonly accountId: string;
  readonly category: TicketCategory;
  readonly subject: string;
  readonly message: string;
  readonly attachmentUrls: readonly string[];
  readonly linkedReference: LinkedReference | null;
  readonly channel: TicketChannel;
  readonly idempotencyKey: string | null;
}
