export interface AddGroupMembersCommand {
  readonly actorId: string;
  readonly conversationId: string;
  readonly userIds: readonly string[];
}
