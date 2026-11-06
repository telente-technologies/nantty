import type { Conversation, NewChannelInput } from "@/types";

import { createIdempotencyKey, sendRequestToWebappServer } from "./clientApi.service";

export interface ChannelInvitation {
  readonly id: string;
  readonly channelId: string;
  readonly channelTitle: string | null;
  readonly inviterId: string;
  readonly inviteeId: string;
  readonly status: "pending" | "accepted" | "declined" | "expired";
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface ChannelInvitationPage {
  readonly data: readonly ChannelInvitation[];
  readonly nextCursor: string | null;
}

export interface ChannelInvitationLink {
  readonly id: string;
  readonly channelId: string;
  /** Opaque bearer token returned once by create; only its hash is stored by the API. */
  readonly token: string;
  readonly expiresAt: string;
}

export interface ChannelInvitationLinkRecord {
  readonly id: string;
  readonly channelId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

export interface ChannelInvitationLinkPage {
  readonly data: readonly ChannelInvitationLinkRecord[];
  readonly nextCursor: string | null;
}

export interface ChannelInvitationLinkPreview {
  readonly channel: { readonly title: string | null; readonly subscriberCount: number };
  readonly expiresAt: string;
}

export const channelsService = {
  createBroadcastChannel: (input: NewChannelInput) =>
    sendRequestToWebappServer<Conversation>("/api/v1/channels", { method: "POST", body: input }),
  createInvitationLink: (channelId: string, expiresInHours: 24 | 168 | 720 = 168) =>
    sendRequestToWebappServer<ChannelInvitationLink>(`/api/v1/channels/${encodeURIComponent(channelId)}/invitation-links`, { method: "POST", body: { expiresInHours }, idempotencyKey: createIdempotencyKey("channel_invitation_link") }),
  listInvitationLinks: (channelId: string, cursor?: string) =>
    sendRequestToWebappServer<ChannelInvitationLinkPage>(`/api/v1/channels/${encodeURIComponent(channelId)}/invitation-links`, { query: { cursor, limit: 20 } }),
  revokeInvitationLink: (channelId: string, linkId: string) =>
    sendRequestToWebappServer<ChannelInvitationLinkRecord>(`/api/v1/channels/${encodeURIComponent(channelId)}/invitation-links/${encodeURIComponent(linkId)}`, { method: "DELETE", idempotencyKey: createIdempotencyKey("channel_invitation_link_revoke") }),
  previewInvitationLink: (token: string) =>
    sendRequestToWebappServer<ChannelInvitationLinkPreview>(`/api/v1/channels/invitation-links/${encodeURIComponent(token)}/preview`),
  claimInvitationLink: (token: string) =>
    sendRequestToWebappServer<ChannelInvitation>(`/api/v1/channels/invitation-links/${encodeURIComponent(token)}/claim`, { method: "POST", idempotencyKey: createIdempotencyKey("channel_invitation_claim") }),
  listInvitations: (cursor?: string) =>
    sendRequestToWebappServer<ChannelInvitationPage>("/api/v1/channel-invitations", { query: { status: "pending", cursor, limit: 20 } }),
  acceptInvitation: (invitationId: string) =>
    sendRequestToWebappServer<ChannelInvitation>(`/api/v1/channel-invitations/${encodeURIComponent(invitationId)}/accept`, { method: "POST", idempotencyKey: createIdempotencyKey("channel_invitation_accept") }),
  declineInvitation: (invitationId: string) =>
    sendRequestToWebappServer<ChannelInvitation>(`/api/v1/channel-invitations/${encodeURIComponent(invitationId)}/decline`, { method: "POST", idempotencyKey: createIdempotencyKey("channel_invitation_decline") }),
};
