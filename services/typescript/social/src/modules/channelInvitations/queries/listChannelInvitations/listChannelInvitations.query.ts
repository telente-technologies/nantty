import type { ChannelInvitationStatus } from "../../../../generated/prisma/client.js";

export interface ListChannelInvitationsQuery {
  readonly inviteeId: string;
  readonly status: ChannelInvitationStatus;
  readonly cursor?: string;
  readonly limit: number;
}
