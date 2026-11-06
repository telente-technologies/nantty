export interface CreateGroupInvitationCommand {
  readonly actorId: string;
  readonly conversationId: string;
  readonly inviteeId: string;
}
