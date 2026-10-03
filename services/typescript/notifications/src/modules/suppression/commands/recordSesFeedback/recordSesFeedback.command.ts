export interface RecordSesFeedbackCommand {
  readonly feedback: unknown;
}

export interface RecordSesFeedbackResult {
  readonly suppressed: readonly { readonly email: string; readonly reason: "hard_bounce" | "complaint" }[];
}
