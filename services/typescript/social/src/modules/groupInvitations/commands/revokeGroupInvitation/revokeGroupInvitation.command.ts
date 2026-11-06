export interface RevokeGroupInvitationCommand {
  readonly actorId: string;
  readonly conversationId: string;
  readonly invitationId: string;
}
