export interface UpdateConversationCommand {
  readonly viewerId: string;
  readonly conversationId: string;
  readonly name: string | undefined;
  readonly photoMediaId: string | undefined;
  readonly disappearingMessagesSeconds: number | null | undefined;
  readonly onlyAdminsCanMentionAll: boolean | undefined;
}
