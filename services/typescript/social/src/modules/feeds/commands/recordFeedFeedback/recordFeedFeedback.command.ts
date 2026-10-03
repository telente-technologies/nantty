export interface RecordFeedFeedbackCommand {
  readonly userId: string;
  readonly postId: string;
  readonly kind: string;
}
