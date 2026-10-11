export interface UpdateConversationCommand {
  readonly viewerId: string;
  readonly conversationId: string;
  readonly name: string | undefined;
  readonly encryptedAttributes: string | undefined;
  readonly photoMediaId: string | null | undefined;
  readonly disappearingMessagesSeconds: number | null | undefined;
  readonly onlyAdminsCanMentionAll: boolean | undefined;
}
