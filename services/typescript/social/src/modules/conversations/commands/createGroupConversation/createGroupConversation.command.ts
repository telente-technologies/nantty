export interface CreateGroupConversationCommand {
  readonly creatorId: string;
  readonly name: string;
  readonly photoMediaId: string | undefined;
  readonly memberIds: readonly string[];
}
