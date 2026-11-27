import type {
  Comment,
  CommentHiddenState,
  CoinActivityEntry,
  CoinBalance,
  CoinPackage,
  CoinTransferQuote,
  CoinTransferReceipt,
  ID,
  LiveComment,
  LiveGift,
  LiveSessionDetails,
  MentionEntity,
  MyPostComment,
  Page,
  SentLiveGiftReceipt,
} from "@/types";
import type { CreatorSubscriptionCheckout, CreatorSubscriptionPlan, CreatorSubscriptionState } from "@/types/creator.type";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export type ReportTargetType = "post" | "clip" | "comment" | "live" | "space" | "user" | "product" | "store" | "sound" | "message";
export type ShareReferenceKind = "post" | "clip" | "video" | "product" | "live" | "store" | "profile";

export interface ShareEncryption {
  readonly conversationId: ID;
  readonly deviceId: string;
  readonly ciphertext: string;
}

export const toShareReferenceKind = (kind: ShareReferenceKind) => (kind === "video" ? "post" : kind);

export interface CoinPurchaseCheckout {
  readonly reference: string;
  readonly accessCode?: string;
  readonly checkoutUrl?: string | null;
  readonly authorizationUrl: string;
}

export interface AccountEmailStatus {
  readonly email: string | null;
  readonly emailVerified: boolean;
}

export const commentsService = {
  fetchReplies: (commentId: ID, cursor: string | null | undefined) =>
    sendRequestToWebappServer<Page<Comment>>(`/api/v1/comments/${commentId}/replies`, { query: { cursor: cursor ?? undefined } }),
  addComment: (postId: ID, text: string, parentCommentId: ID | undefined, mentions: readonly MentionEntity[], quotedPostId?: ID | null, asProfileId?: ID) =>
    sendRequestToWebappServer<Comment>(`/api/v1/posts/${postId}/comments`, {
      method: "POST",
      body: { text, parentCommentId, mentions, ...(quotedPostId === undefined ? {} : { quotedPostId }), ...(asProfileId === undefined ? {} : { asProfileId }) },
      idempotencyKey: createIdempotencyKey("comment"),
    }),
  likeComment: (commentId: ID) => sendRequestToWebappServer<void>(`/api/v1/comments/${commentId}/like`, { method: "POST" }),
  unlikeComment: (commentId: ID) => sendRequestToWebappServer<void>(`/api/v1/comments/${commentId}/like`, { method: "DELETE" }),
  deleteComment: (commentId: ID) => sendRequestToWebappServer<void>(`/api/v1/comments/${commentId}`, { method: "DELETE" }),
  pinComment: (postId: ID, commentId: ID) =>
    sendRequestToWebappServer<Comment>(`/api/v1/posts/${postId}/comments/${commentId}/pin`, { method: "PUT", idempotencyKey: createIdempotencyKey("pin") }),
  unpinComment: (postId: ID, commentId: ID) =>
    sendRequestToWebappServer<void>(`/api/v1/posts/${postId}/comments/${commentId}/pin`, { method: "DELETE", idempotencyKey: createIdempotencyKey("unpin") }),
  hideComment: (postId: ID, commentId: ID) =>
    sendRequestToWebappServer<CommentHiddenState>(`/api/v1/posts/${postId}/comments/${commentId}/hide`, { method: "PUT" }),
  unhideComment: (postId: ID, commentId: ID) =>
    sendRequestToWebappServer<CommentHiddenState>(`/api/v1/posts/${postId}/comments/${commentId}/hide`, { method: "DELETE" }),
  listHiddenComments: (cursor: string | undefined) =>
    sendRequestToWebappServer<Page<MyPostComment>>("/api/v1/me/post-comments", { query: { filter: "hidden", cursor } }),
};

export const reportsService = {
  submitReport: (targetType: ReportTargetType, targetId: ID, reason: string, details: string) =>
    sendRequestToWebappServer<{ id: ID; status: string }>("/api/v1/reports", { method: "POST", body: { targetType, targetId, reason, details }, idempotencyKey: createIdempotencyKey("report") }),
};

export const chatSharesService = {
  shareIntoChats: (conversationIds: readonly ID[], kind: ShareReferenceKind, referenceId: ID, encryptions: readonly ShareEncryption[] = []) =>
    sendRequestToWebappServer<{ sentCount: number; shareCount: number }>("/api/v1/chat/shares", {
      method: "POST",
      body: { conversationIds, reference: { kind: toShareReferenceKind(kind), id: referenceId }, ...(encryptions.length > 0 ? { encryptions } : {}) },
      idempotencyKey: createIdempotencyKey("share"),
    }),
};

export const liveService = {
  fetchLiveSession: (liveId: ID) => sendRequestToWebappServer<LiveSessionDetails>(`/api/v1/lives/${liveId}`),
  fetchLiveComments: (liveId: ID) => sendRequestToWebappServer<Page<LiveComment>>(`/api/v1/lives/${liveId}/comments`),
  issueMediaToken: (liveId: ID) => sendRequestToWebappServer<{ url: string; token: string; canPublish: boolean; role: string }>(`/api/v1/lives/${liveId}/media-token`, { method: "POST" }),
  postLiveComment: (liveId: ID, text: string) => sendRequestToWebappServer<LiveComment>(`/api/v1/lives/${liveId}/comments`, { method: "POST", body: { text } }),
  fetchGiftCatalog: () => sendListRequestToWebappServer<LiveGift>("/api/v1/gifts"),
  sendGift: (liveId: ID, giftId: ID, quantity: number) =>
    sendRequestToWebappServer<SentLiveGiftReceipt>(`/api/v1/lives/${liveId}/gifts`, { method: "POST", body: { giftId, quantity }, idempotencyKey: createIdempotencyKey("gift") }),
};

export const coinsService = {
  fetchCoinBalance: () => sendRequestToWebappServer<CoinBalance>("/api/v1/coins/balance"),
  fetchWebCoinPackages: () => sendListRequestToWebappServer<CoinPackage>("/api/v1/coins/packages"),
  fetchCoinActivity: () => sendListRequestToWebappServer<CoinActivityEntry>("/api/v1/coins/transactions"),
  startCoinPurchase: (packageId: ID) =>
    sendRequestToWebappServer<CoinPurchaseCheckout>("/api/v1/coins/purchases", { method: "POST", body: { packageId }, idempotencyKey: createIdempotencyKey("coins") }),
  confirmCoinPurchase: (reference: string) =>
    sendRequestToWebappServer<{ status: "pending" | "succeeded" | "failed"; coins: number }>(`/api/v1/coins/purchases/${encodeURIComponent(reference)}/verify`, { method: "POST" }),
  fetchCoinTransferQuote: (coins: number) => sendRequestToWebappServer<CoinTransferQuote>("/api/v1/coins/transfers/quote", { query: { coins } }),
  transferCoins: (recipientUserId: ID, coins: number, expectedFeeBasisPoints: number, idempotencyKey: string) =>
    sendRequestToWebappServer<CoinTransferReceipt>("/api/v1/coins/transfers", { method: "POST", body: { recipientUserId, coins, expectedFeeBasisPoints }, idempotencyKey }),
};

export const creatorSubscriptionsService = {
  fetchPlans: (creatorId: ID) => sendListRequestToWebappServer<CreatorSubscriptionPlan>(`/api/v1/creators/${creatorId}/subscription-plans`),
  startSubscription: (creatorId: ID, planId: ID) =>
    sendRequestToWebappServer<CreatorSubscriptionCheckout>(`/api/v1/creators/${creatorId}/subscriptions`, { method: "POST", body: { planId }, idempotencyKey: createIdempotencyKey("subscribe") }),
  fetchSubscriptionState: (subscriptionId: ID) => sendRequestToWebappServer<CreatorSubscriptionState>(`/api/v1/creator-subscriptions/${encodeURIComponent(subscriptionId)}`),
  cancelSubscription: (subscriptionId: ID) => sendRequestToWebappServer<CreatorSubscriptionState>(`/api/v1/creator-subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { method: "POST" }),
  resumeSubscription: (subscriptionId: ID) => sendRequestToWebappServer<CreatorSubscriptionState>(`/api/v1/creator-subscriptions/${encodeURIComponent(subscriptionId)}/resume`, { method: "POST" }),
  fetchMySubscriptions: async () => (await sendRequestToWebappServer<{ readonly data: CreatorSubscriptionState[] }>("/api/v1/creator-subscriptions")).data,
};

export const emailVerificationService = {
  fetchAccountEmailStatus: async (): Promise<AccountEmailStatus> => {
    const viewer = await sendRequestToWebappServer<{ email?: string | null; emailVerified?: boolean }>("/api/v1/users/me");
    return { email: viewer.email ?? null, emailVerified: viewer.emailVerified ?? false };
  },
  sendVerificationCode: () => sendRequestToWebappServer<{ expiresIn: number; resendAfterSeconds: number }>("/api/v1/users/me/email/verification", { method: "POST" }),
  confirmVerificationCode: (code: string) => sendRequestToWebappServer<AccountEmailStatus>("/api/v1/users/me/email/verification/confirm", { method: "POST", body: { code } }),
};
