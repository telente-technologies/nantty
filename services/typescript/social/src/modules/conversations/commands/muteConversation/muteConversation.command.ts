export type MuteDuration = "8h" | "1w" | "always" | "off";

export interface MuteConversationCommand {
  readonly viewerId: string;
  readonly conversationId: string;
  readonly duration: MuteDuration;
}
