export type SupportInboxTopic = "support_ticket" | "contact" | "legal" | "copyright";

export interface SupportInboxMessage {
  readonly topic: SupportInboxTopic;
  readonly subject: string;
  readonly text: string;
  readonly replyTo?: string;
}

export interface SupportInbox {
  notifySupportTeam(message: SupportInboxMessage): Promise<void>;
}
