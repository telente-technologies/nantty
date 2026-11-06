export interface PostCustomerReplyCommand {
  readonly accountId: string;
  readonly ticketId: string;
  readonly text: string;
  readonly attachmentUrls: readonly string[];
  readonly idempotencyKey: string | null;
}
