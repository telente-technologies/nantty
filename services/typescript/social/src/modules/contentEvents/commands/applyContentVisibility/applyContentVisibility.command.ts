export type ModerationVisibilityValue = "visible" | "restricted" | "hidden" | "removed";

export interface ApplyContentVisibilityCommand {
  readonly targetType: string;
  readonly targetId: string;
  readonly visibility: ModerationVisibilityValue;
  readonly occurredAt: Date;
}
