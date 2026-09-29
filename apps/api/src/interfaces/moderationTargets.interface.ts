export const MODERATION_TARGET_TYPES = ["post", "comment", "user", "product", "live", "message"] as const;
export type ModerationTargetType = (typeof MODERATION_TARGET_TYPES)[number];

export type ContentEnforcementAction = "hide" | "remove" | "restore";

export interface ModerationTargetDescription {
  readonly ownerUserId: string;
  readonly summary: string;
}

export interface ModerationTargetGateway {
  readonly targetType: ModerationTargetType;
  describeTarget(targetId: string): Promise<ModerationTargetDescription | undefined>;
  applyContentAction(targetId: string, action: ContentEnforcementAction, decidedAt: Date): Promise<boolean>;
  isReportableBy?(targetId: string, userId: string): Promise<boolean>;
}
