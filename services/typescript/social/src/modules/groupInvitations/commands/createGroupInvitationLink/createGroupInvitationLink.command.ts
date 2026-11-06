export interface CreateGroupInvitationLinkCommand {
  readonly actorId: string;
  readonly conversationId: string;
  readonly expiresInHours: 24 | 168 | 720;
}
