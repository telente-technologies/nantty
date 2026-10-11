export interface GetChatReportabilityQuery {
  readonly conversationId: string;
  readonly reporterId: string;
  readonly reportedUserId?: string;
  readonly messageId?: string;
}
