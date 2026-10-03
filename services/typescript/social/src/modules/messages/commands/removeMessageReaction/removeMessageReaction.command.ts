export interface RemoveMessageReactionCommand {
  readonly viewerId: string;
  readonly messageId: string;
  readonly emoji: string;
}
