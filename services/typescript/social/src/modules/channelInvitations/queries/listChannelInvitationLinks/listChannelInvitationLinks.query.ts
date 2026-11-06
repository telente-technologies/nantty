export interface ListChannelInvitationLinksQuery {
  readonly actorId: string;
  readonly channelId: string;
  readonly cursor?: string;
  readonly limit: number;
}
