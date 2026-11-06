export interface ListGroupInvitationsQuery {
  readonly accountId: string;
  readonly direction: "received" | "sent";
  readonly status: "pending" | "accepted";
  readonly cursor: string | undefined;
  readonly limit: number;
}
