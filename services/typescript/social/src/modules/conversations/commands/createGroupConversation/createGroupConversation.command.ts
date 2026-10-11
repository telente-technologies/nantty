export interface CreateGroupConversationCommand {
  readonly creatorId: string;
  readonly plaintextName: unknown;
  readonly encryptedAttributes: string | undefined;
  readonly photoMediaId: string | undefined;
  readonly memberIds: readonly string[];
}
