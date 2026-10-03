export interface RemoveGroupMemberCommand {
  readonly actorId: string;
  readonly conversationId: string;
  readonly userId: string;
}
