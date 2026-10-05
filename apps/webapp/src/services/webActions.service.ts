import type {
  Comment,
  CoinBalance,
  CoinPackage,
  ID,
  LiveComment,
  LiveGift,
  LiveSessionDetails,
  MentionEntity,
  Page,
  SentLiveGiftReceipt,
} from "@/types";
import type { CreatorSubscriptionCheckout, CreatorSubscriptionPlan, CreatorSubscriptionState } from "@/types/creator.type";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export type ReportTargetType = "post" | "clip" | "comment" | "live" | "user" | "product" | "message";
export type ShareReferenceKind = "post" | "clip" | "video" | "product" | "live" | "store" | "profile";

export interface CoinPurchaseCheckout {
  readonly reference: string;
  readonly accessCode: string;
  readonly authorizationUrl: string;
}

export interface AccountEmailStatus {
  readonly email: string | null;
  readonly emailVerified: boolean;
}

export const commentsService = {
  fetchReplies: (commentId: ID, cursor: string | null) =>
    sendRequestToWebappServer<Page<Comment>>(`/api/v1/comments/${commentId}/replies`, { query: { cursor: cursor ?? undefined } }),
  addComment: (postId: ID, text: string, parentCommentId: ID | undefined, mentions: readonly MentionEntity[]) =>
    sendRequestToWebappServer<Comment>(`/api/v1/posts/${postId}/comments`, { method: "POST", body: { text, parentCommentId, mentions }, idempotencyKey: createIdempotencyKey("comment") }),
  likeComment: (commentId: ID) => sendRequestToWebappServer<void>(`/api/v1/comments/${commentId}/like`, { method: "POST" }),
  unlikeComment: (commentId: ID) => sendRequestToWebappServer<void>(`/api/v1/comments/${commentId}/like`, { method: "DELETE" }),
  deleteComment: (commentId: ID) => sendRequestToWebappServer<void>(`/api/v1/comments/${commentId}`, { method: "DELETE" }),
};

export const reportsService = {
  submitReport: (targetType: ReportTargetType, targetId: ID, reason: string, details: string) =>
    sendRequestToWebappServer<{ id: ID; status: string }>("/api/v1/reports", { method: "POST", body: { targetType, targetId, reason, details }, idempotencyKey: createIdempotencyKey("report") }),
};

export const chatSharesService = {
  shareIntoChats: (conversationIds: readonly ID[], kind: ShareReferenceKind, referenceId: ID) =>
    sendRequestToWebappServer<{ sentCount: number; shareCount: number }>("/api/v1/chat/shares", {
      method: "POST",
      body: { conversationIds, reference: { kind: kind === "video" ? "post" : kind, id: referenceId } },
      idempotencyKey: createIdempotencyKey("share"),
    }),
};

export const liveService = {
  fetchLiveSession: (liveId: ID) => sendRequestToWebappServer<LiveSessionDetails>(`/api/v1/lives/${liveId}`),
  fetchLiveComments: (liveId: ID) => sendRequestToWebappServer<Page<LiveComment>>(`/api/v1/lives/${liveId}/comments`),
  postLiveComment: (liveId: ID, text: string) => sendRequestToWebappServer<LiveComment>(`/api/v1/lives/${liveId}/comments`, { method: "POST", body: { text } }),
  fetchGiftCatalog: () => sendListRequestToWebappServer<LiveGift>("/api/v1/gifts"),
  sendGift: (liveId: ID, giftId: ID, quantity: number) =>
    sendRequestToWebappServer<SentLiveGiftReceipt>(`/api/v1/lives/${liveId}/gifts`, { method: "POST", body: { giftId, quantity }, idempotencyKey: createIdempotencyKey("gift") }),
};

export const coinsService = {
  fetchCoinBalance: () => sendRequestToWebappServer<CoinBalance>("/api/v1/coins/balance"),
  fetchWebCoinPackages: () => sendListRequestToWebappServer<CoinPackage>("/api/v1/coins/packages"),
  startCoinPurchase: (packageId: ID) =>
    sendRequestToWebappServer<CoinPurchaseCheckout>("/api/v1/coins/purchases", { method: "POST", body: { packageId }, idempotencyKey: createIdempotencyKey("coins") }),
  confirmCoinPurchase: (reference: string) =>
    sendRequestToWebappServer<{ status: "pending" | "succeeded" | "failed"; coins: number }>(`/api/v1/coins/purchases/${encodeURIComponent(reference)}/verify`, { method: "POST" }),
};

export const creatorSubscriptionsService = {
  fetchPlans: (creatorId: ID) => sendRequestToWebappServer<CreatorSubscriptionPlan[]>(`/api/v1/creators/${creatorId}/subscription-plans`),
  startSubscription: (creatorId: ID, planId: ID) =>
    sendRequestToWebappServer<CreatorSubscriptionCheckout>(`/api/v1/creators/${creatorId}/subscriptions`, { method: "POST", body: { planId }, idempotencyKey: createIdempotencyKey("subscribe") }),
  fetchSubscriptionState: (subscriptionId: ID) => sendRequestToWebappServer<CreatorSubscriptionState>(`/api/v1/subscriptions/${encodeURIComponent(subscriptionId)}`),
};

export const emailVerificationService = {
  fetchAccountEmailStatus: () => sendRequestToWebappServer<AccountEmailStatus>("/api/v1/users/me/email"),
  sendVerificationCode: () => sendRequestToWebappServer<{ expiresIn: number; resendAfterSeconds: number }>("/api/v1/users/me/email/verification", { method: "POST" }),
  confirmVerificationCode: (code: string) => sendRequestToWebappServer<AccountEmailStatus>("/api/v1/users/me/email/verification/confirm", { method: "POST", body: { code } }),
};
