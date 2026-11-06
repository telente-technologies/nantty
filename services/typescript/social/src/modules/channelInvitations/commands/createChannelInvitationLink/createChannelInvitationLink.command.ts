export interface CreateChannelInvitationLinkCommand {
  readonly actorId: string;
  readonly channelId: string;
  readonly expiresInHours: 24 | 168 | 720;
}
