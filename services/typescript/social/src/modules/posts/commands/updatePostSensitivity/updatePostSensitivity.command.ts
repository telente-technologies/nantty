export interface UpdatePostSensitivityCommand {
  readonly actorId: string;
  readonly postId: string;
  readonly sensitiveLabels: readonly string[];
}
