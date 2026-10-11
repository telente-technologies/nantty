import { ApiError } from "@/errors/api.error";
import type { FollowRequest } from "@/types";

import { isoDateHoursAgo } from "./fixtures.mock";
import { currentMediaAsset } from "./media.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { userSummaryById } from "./userDirectory.mock";
import { usersMocks } from "./users.mock";

const pendingFollowRequests: FollowRequest[] = [
  { id: "fr_1", requester: userSummaryById("u_3"), createdAt: isoDateHoursAgo(3) },
  { id: "fr_2", requester: userSummaryById("u_9"), createdAt: isoDateHoursAgo(26) },
];

const settleFollowRequest = (requestId: string, approve: boolean) => {
  const index = pendingFollowRequests.findIndex((request) => request.id === requestId);
  if (index < 0) throw new ApiError(404, "This follow request is no longer pending.", "FOLLOW_REQUEST_NOT_FOUND");
  pendingFollowRequests.splice(index, 1);
  return { approved: approve };
};

const mediaUrlFor = (mediaId: unknown): string | undefined => {
  if (typeof mediaId !== "string") return undefined;
  const asset = currentMediaAsset(mediaId);
  if (!asset) throw new ApiError(422, "That photo upload could not be found.", "MEDIA_NOT_FOUND");
  return asset.variants[0]?.url ?? `https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&mock=${mediaId}`;
};

const updateMyProfileRoute = usersMocks.find((route) => route.method === "PATCH" && route.path === "/api/v1/users/me")!;

export const profileParityMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me/follow-requests", () => ({ data: [...pendingFollowRequests], nextCursor: null })),
  createMockRoute("POST", "/api/v1/follow-requests/:requestId/accept", ({ params }) => settleFollowRequest(params.requestId!, true)),
  createMockRoute("POST", "/api/v1/follow-requests/:requestId/reject", ({ params }) => settleFollowRequest(params.requestId!, false)),
  createMockRoute("PATCH", "/api/v1/users/me", (context) => {
    const { avatarMediaId, bannerMediaId, ...rest } = (context.body ?? {}) as Record<string, unknown>;
    const name = typeof rest.name === "string" ? rest.name.trim() : undefined;
    if ((name !== undefined && name.length > 320) || (typeof rest.bio === "string" && rest.bio.length > 1200)) throw new ApiError(400, "Validation failed", "VALIDATION_FAILED");
    const avatarUrl = mediaUrlFor(avatarMediaId);
    const bannerUrl = mediaUrlFor(bannerMediaId);
    return updateMyProfileRoute.handler({ ...context, body: { ...rest, ...(name === undefined ? {} : { name }), ...(avatarUrl ? { avatarUrl } : {}), ...(bannerUrl ? { bannerUrl } : {}) } });
  }),
];
