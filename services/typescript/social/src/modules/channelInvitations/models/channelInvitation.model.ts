import type { ChannelInvitationStatus } from "../../../generated/prisma/client.js";

export interface ChannelInvitationView {
  readonly id: string;
  readonly channelId: string;
  readonly channelTitle: string | null;
  readonly inviterId: string;
  readonly inviteeId: string;
  readonly status: ChannelInvitationStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface ChannelInvitationLinkCreatedView {
  readonly id: string;
  readonly channelId: string;
  /** Returned only on creation; only its SHA-256 hash is stored. */
  readonly token: string;
  readonly expiresAt: string;
}

export interface ChannelInvitationLinkPreviewView {
  readonly channel: { readonly title: string | null; readonly subscriberCount: number };
  readonly expiresAt: string;
}

export interface ChannelInvitationLinkManagementView {
  readonly id: string;
  readonly channelId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}
