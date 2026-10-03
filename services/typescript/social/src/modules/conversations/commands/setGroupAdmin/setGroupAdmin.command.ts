export interface SetGroupAdminCommand {
  readonly actorId: string;
  readonly conversationId: string;
  readonly userId: string;
  readonly isAdmin: boolean;
}
