export interface ListGroupInvitationLinksQuery {
  readonly actorId: string;
  readonly conversationId: string;
  readonly cursor?: string;
  readonly limit: number;
}
