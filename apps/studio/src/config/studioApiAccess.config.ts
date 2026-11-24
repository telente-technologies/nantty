export type StudioApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface StudioApiRoute {
  readonly method: StudioApiMethod;
  readonly path: string;
  readonly isPublic?: boolean;
}

const route = (method: StudioApiMethod, path: string, isPublic = false): StudioApiRoute => ({ method, path, isPublic });

export const studioApiRoutes: readonly StudioApiRoute[] = [
  route("POST", "/api/v1/auth/step-up"),
  route("POST", "/api/v1/auth/otp/send"),
  route("POST", "/api/v1/auth/otp/verify"),
  route("PUT", "/api/v1/users/me/consents"),
  route("PATCH", "/api/v1/users/me/preferences"),
  route("GET", "/api/v1/account/status"),
  route("GET", "/api/v1/creators/me"),
  route("GET", "/api/v1/creators/dashboard"),
  route("GET", "/api/v1/analytics/creator/summary"),
  route("GET", "/api/v1/creators/revenue-rules"),
  route("GET", "/api/v1/creators/earnings"),
  route("GET", "/api/v1/creators/eligibility"),
  route("GET", "/api/v1/creators/applications/me"),
  route("GET", "/api/v1/creators/me/affiliate-catalog"),
  route("GET", "/api/v1/creators/me/affiliate-promotions"),
  route("GET", "/api/v1/creators/me/affiliate-earnings"),
  route("POST", "/api/v1/creators/me/affiliate-links"),
  route("POST", "/api/v1/creators/affiliations"),
  route("GET", "/api/v1/creators/brand-deals"),
  route("POST", "/api/v1/creators/brand-deals"),
  route("DELETE", "/api/v1/creators/brand-deals/:dealId"),
  route("GET", "/api/v1/creators/me/subscription-plans"),
  route("POST", "/api/v1/creators/me/subscription-plans"),
  route("PATCH", "/api/v1/creators/me/subscription-plans/:planId"),
  route("GET", "/api/v1/creators/me/subscription-plans/price-tiers"),
  route("GET", "/api/v1/creators/me/subscribers"),
  route("GET", "/api/v1/creators/me/analytics/gifts/streams/:liveId"),
  route("GET", "/api/v1/users/:userId/posts"),
  route("GET", "/api/v1/posts/:postId/analytics"),
  route("GET", "/api/v1/users/me/followers"),
  route("GET", "/api/v1/rankings"),
  route("GET", "/api/v1/wallets/me"),
  route("GET", "/api/v1/wallets/me/withdrawals"),
  route("GET", "/api/v1/banks"),
  route("GET", "/api/v1/payments/payout-fees"),
  route("GET", "/api/v1/payments/payout-onboarding/me"),
  route("PUT", "/api/v1/payments/payout-onboarding/me/identity"),
  route("PUT", "/api/v1/payments/payout-onboarding/me/business"),
  route("PUT", "/api/v1/payments/payout-onboarding/me/bank"),
  route("POST", "/api/v1/payments/payout-onboarding/me/resolve"),
  route("POST", "/api/v1/payments/payout-onboarding/me/retry"),
  route("POST", "/api/v1/payments/payout-onboarding/me/document-link"),
  route("POST", "/api/v1/payments/payout-onboarding/me/bank-validation"),
  route("GET", "/api/v1/payments/payout-onboarding/me/bank-validation"),
  route("GET", "/api/v1/payments/wallet/me"),
  route("GET", "/api/v1/payments/verification/me"),
  route("GET", "/api/v1/lives"),
  route("POST", "/api/v1/lives"),
  route("GET", "/api/v1/lives/:liveId"),
  route("POST", "/api/v1/lives/:liveId/start"),
  route("POST", "/api/v1/lives/:liveId/end"),
  route("GET", "/api/v1/lives/:liveId/stream-key"),
  route("POST", "/api/v1/lives/:liveId/stream-key"),
  route("GET", "/api/v1/lives/:liveId/comments"),
  route("POST", "/api/v1/lives/:liveId/comments"),
  route("GET", "/api/v1/lives/:liveId/products"),
  route("POST", "/api/v1/lives/:liveId/pins"),
  route("DELETE", "/api/v1/lives/:liveId/pins"),
  route("GET", "/api/v1/lives/:liveId/overlays"),
  route("PUT", "/api/v1/lives/:liveId/overlays"),
  route("GET", "/api/v1/lives/:liveId/safety"),
  route("GET", "/api/v1/lives/:liveId/stage"),
  route("POST", "/api/v1/live-safety/:liveId/appeal"),
  route("POST", "/api/v1/reports"),
  route("GET", "/api/v1/seller/stores/mine"),
  route("GET", "/api/v1/seller/products"),
  route("GET", "/api/v1/seller/products/:productId"),
  route("PATCH", "/api/v1/lives/:liveId"),
  route("POST", "/api/v1/lives/:liveId/cancel"),
  route("GET", "/api/v1/lives/:liveId/stream-health"),
  route("GET", "/api/v1/lives/:liveId/recordings"),
  route("DELETE", "/api/v1/lives/:liveId/recordings/:recordingId"),
  route("GET", "/api/v1/lives/:liveId/room-settings"),
  route("PUT", "/api/v1/lives/:liveId/room-settings"),
  route("GET", "/api/v1/live/host-defaults"),
  route("PUT", "/api/v1/live/host-defaults"),
  route("GET", "/api/v1/me/post-comments"),
  route("POST", "/api/v1/posts/:postId/comments"),
  route("DELETE", "/api/v1/comments/:commentId"),
  route("PUT", "/api/v1/posts/:postId/comments/:commentId/pin"),
  route("DELETE", "/api/v1/posts/:postId/comments/:commentId/pin"),
  route("PUT", "/api/v1/posts/:postId/comments/:commentId/hide"),
  route("DELETE", "/api/v1/posts/:postId/comments/:commentId/hide"),
  route("GET", "/api/v1/notifications/unread-count"),
  route("GET", "/api/v1/notifications/preferences"),
  route("PATCH", "/api/v1/notifications/preferences"),
  route("GET", "/api/v1/users/me/mention-privacy"),
  route("PUT", "/api/v1/users/me/mention-privacy"),
  route("GET", "/api/v1/users/me/message-privacy"),
  route("PUT", "/api/v1/users/me/message-privacy"),
  route("GET", "/api/v1/overlay-scenes/:sceneId", true),
];

export const mockOnlyStudioApiRoutes: readonly StudioApiRoute[] = [route("POST", "/api/v1/payments/payout-onboarding/me/document-link/complete")];

function doesPathMatchTemplate(template: string, path: string): boolean {
  const templateSegments = template.split("/");
  const pathSegments = path.split("/");
  return templateSegments.length === pathSegments.length && templateSegments.every((segment, index) => (segment.startsWith(":") ? (pathSegments[index] ?? "") !== "" : segment === pathSegments[index]));
}

export function findStudioApiRoute(method: string, path: string, includeMockOnly = false): StudioApiRoute | null {
  const candidates = includeMockOnly ? [...studioApiRoutes, ...mockOnlyStudioApiRoutes] : studioApiRoutes;
  return candidates.find((candidate) => candidate.method === method && doesPathMatchTemplate(candidate.path, path)) ?? null;
}
