export type NotificationChannel = "PUSH" | "EMAIL" | "SMS" | "IN_APP";

export interface TemplateVariable {
  readonly name: string;
  readonly sampleValue: string;
}

export interface NotificationTemplateContent {
  readonly event: string;
  readonly channel: NotificationChannel;
  readonly locale: string;
  readonly isEnabled: boolean;
  readonly subject: string | null;
  readonly body: string;
  readonly variables: readonly TemplateVariable[];
}
