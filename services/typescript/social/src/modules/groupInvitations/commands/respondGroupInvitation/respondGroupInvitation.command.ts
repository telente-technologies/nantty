export interface RespondGroupInvitationCommand {
  readonly accountId: string;
  readonly invitationId: string;
  readonly decision: "accept" | "decline";
}
