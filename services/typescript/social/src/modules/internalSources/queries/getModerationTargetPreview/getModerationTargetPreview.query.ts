export interface GetModerationTargetPreviewQuery {
  readonly targetType: "post" | "clip" | "comment" | "sound" | "message";
  readonly targetId: string;
}
