export interface ApplySensitiveLabelsCommand {
  readonly targetType: string;
  readonly targetId: string;
  readonly source: "moderation" | "advisory";
  readonly labels: readonly string[];
  readonly occurredAt: Date;
}
