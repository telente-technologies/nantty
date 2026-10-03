export interface RespondToFollowRequestCommand {
  readonly followeeId: string;
  readonly requestId: string;
  readonly decision: "accept" | "reject";
}
