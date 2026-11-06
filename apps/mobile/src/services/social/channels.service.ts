import type { Conversation, NewChannelInput } from "@/types";

import { api, generateIdempotencyKey } from "../core/apiClient.service";

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

export interface ChannelInvitationLink {
  readonly id: string;
  readonly channelId: string;
  /** Opaque bearer token is returned only at creation; never log or persist it. */
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

export interface ChannelInvitationLinkPreview {
  readonly channel: { readonly title: string | null; readonly subscriberCount: number };
  readonly expiresAt: string;
}

const mutationOptions = () => ({ idempotencyKey: generateIdempotencyKey() });

export const channelsService = {
  createBroadcastChannel: (input: NewChannelInput) => api.post<Conversation>("/api/v1/channels", input),
  subscribeToChannel: (channelId: string) => api.post<Conversation>(`/api/v1/channels/${channelId}/subscribe`),
  unsubscribeFromChannel: (channelId: string) => api.delete<void>(`/api/v1/channels/${channelId}/subscribe`),
  createInvitationLink: (channelId: string, expiresInHours: 24 | 168 | 720 = 168) =>
    api.post<ChannelInvitationLink>(`/api/v1/channels/${encodeURIComponent(channelId)}/invitation-links`, { expiresInHours }, mutationOptions()),
  listInvitationLinks: (channelId: string, cursor?: string) =>
    api.getPage<ChannelInvitationLinkRecord>(`/api/v1/channels/${encodeURIComponent(channelId)}/invitation-links`, { cursor, limit: 20 }),
  revokeInvitationLink: (channelId: string, linkId: string) =>
    api.delete<ChannelInvitationLinkRecord>(`/api/v1/channels/${encodeURIComponent(channelId)}/invitation-links/${encodeURIComponent(linkId)}`, mutationOptions()),
  previewInvitationLink: (token: string) =>
    api.get<ChannelInvitationLinkPreview>(`/api/v1/channels/invitation-links/${encodeURIComponent(token)}/preview`),
  claimInvitationLink: (token: string) =>
    api.post<ChannelInvitation>(`/api/v1/channels/invitation-links/${encodeURIComponent(token)}/claim`, undefined, mutationOptions()),
  listInvitations: (cursor?: string) =>
    api.getPage<ChannelInvitation>("/api/v1/channel-invitations", { status: "pending", cursor, limit: 20 }),
  acceptInvitation: (invitationId: string) =>
    api.post<ChannelInvitation>(`/api/v1/channel-invitations/${encodeURIComponent(invitationId)}/accept`, undefined, mutationOptions()),
  declineInvitation: (invitationId: string) =>
    api.post<ChannelInvitation>(`/api/v1/channel-invitations/${encodeURIComponent(invitationId)}/decline`, undefined, mutationOptions()),
};
