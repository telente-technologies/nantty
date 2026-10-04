export interface RateTicketCommand {
  readonly accountId: string;
  readonly ticketId: string;
  readonly score: number;
  readonly comment: string | null;
}
