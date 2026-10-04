export interface GetModerationTargetPreviewQuery {
  readonly targetType: "post" | "clip" | "comment" | "sound";
  readonly targetId: string;
}
