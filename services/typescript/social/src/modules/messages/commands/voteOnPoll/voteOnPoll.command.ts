export interface VoteOnPollCommand {
  readonly viewerId: string;
  readonly messageId: string;
  readonly optionId: string;
}
