import { ApiError } from "@/errors/api.error";
import { MAXIMUM_STREAMERS_ON_STAGE, type MuteStreamerInput } from "@/types/liveStage.type";

import { createMockRoute, mockPage, type MockRoute } from "./registry.mock";
import { hashTextToSeed, INVITE_RESPONSE_DELAY_MS, listMockAudienceUsers, VIEWER_REQUEST_AUTO_APPROVE_MS, type MockStage } from "./liveStageSeeds.mock";
import {
  addGuestToMockStageOrThrow,
  buildMockGuestSlot,
  countReservedStageSeats,
  findOrCreateMockStageAdvancedToNow,
  isStreamerOnMockStage,
  removeStreamerFromMockStage,
  serializeMockStage,
  signedInMockUserSummary,
} from "./liveStageStore.mock";

const requireHostedStage = (liveId: string) => {
  const stage = findOrCreateMockStageAdvancedToNow(liveId);
  if (!stage.isHostedByMe) throw new ApiError(403, "Only the host can manage guests.");
  return stage;
};

const findStreamerOrThrow = (stage: MockStage, userId: string) => {
  const streamer = stage.streamers.find((candidate) => candidate.user.id === userId);
  if (!streamer) throw new ApiError(404, "That guest is no longer on stage.", "RECIPIENT_NOT_ON_STAGE");
  return streamer;
};

const resolveUserIdAlias = (userId: string) => (userId === "me" ? signedInMockUserSummary().id : userId);

export const liveGuestsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/lives/:liveId/stage", ({ params }) => serializeMockStage(findOrCreateMockStageAdvancedToNow(params.liveId!))),
  createMockRoute("GET", "/api/v1/lives/:liveId/viewers", ({ params, query }) => {
    const stage = findOrCreateMockStageAdvancedToNow(params.liveId!);
    const search = (query.get("q") ?? "").trim().toLowerCase();
    return mockPage(
      listMockAudienceUsers().filter(
        (user) => !isStreamerOnMockStage(stage, user.id) && (!search || user.name.toLowerCase().includes(search) || user.username.toLowerCase().includes(search)),
      ),
    );
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/guests/invitations", ({ params, body }) => {
    const stage = requireHostedStage(params.liveId!);
    const { userId, role = "speaker", title } = body as { userId: string; role?: string; title?: string };
    if (role !== "speaker" && role !== "cohost") throw new ApiError(422, "Role must be speaker or cohost.", "INVALID_STAGE_ROLE");
    const normalizedTitle = title?.trim();
    const hasControlCharacter = [...(normalizedTitle ?? "")].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || (codePoint >= 127 && codePoint <= 159);
    });
    if ([...(normalizedTitle ?? "")].length > 32 || hasControlCharacter) throw new ApiError(422, "Title must be at most 32 characters and contain no control characters.", "INVALID_STAGE_TITLE");
    const user = listMockAudienceUsers().find((candidate) => candidate.id === userId);
    if (!user) throw new ApiError(422, "That viewer has left the live.", "USER_NOT_FOLLOWING_OR_BLOCKED");
    if (countReservedStageSeats(stage) >= MAXIMUM_STREAMERS_ON_STAGE) throw new ApiError(409, "The stage is full. Up to 10 people can be on stage.", "STAGE_FULL");
    const existing = stage.invitations.find((slot) => slot.user.id === userId && slot.state === "invited");
    if (existing) return serializeMockStage(stage);
    const now = Date.now();
    const slot = buildMockGuestSlot(stage, user, now, {
      resolvesAt: now + INVITE_RESPONSE_DELAY_MS,
      willAccept: Math.abs(hashTextToSeed(userId)) % 4 !== 3,
      isForMe: false,
    }, { stageRole: role, title: normalizedTitle });
    stage.invitations.push(slot);
    return serializeMockStage(stage);
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/guests/invitations/:slotId/:response", ({ params }) => {
    const stage = findOrCreateMockStageAdvancedToNow(params.liveId!);
    const slot = stage.invitations.find((candidate) => candidate.id === params.slotId && candidate.isForMe);
    if (!slot || slot.state !== "invited") throw new ApiError(410, "This invite has expired.");
    slot.state = params.response === "accept" ? "onStage" : "declined";
    if (slot.state === "onStage") addGuestToMockStageOrThrow(stage, slot.user, slot.id, slot.stageRole, slot.title);
    return serializeMockStage(stage);
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/guests/requests", ({ params }) => {
    const stage = findOrCreateMockStageAdvancedToNow(params.liveId!);
    const me = signedInMockUserSummary();
    if (stage.isHostedByMe || isStreamerOnMockStage(stage, me.id)) return serializeMockStage(stage);
    if (stage.streamers.length >= MAXIMUM_STREAMERS_ON_STAGE) throw new ApiError(409, "The stage is full right now. Try again later.", "STAGE_FULL");
    const now = Date.now();
    stage.joinRequests.push({ id: `jr_me_${now.toString(36)}`, user: me, state: "pending", requestedAt: new Date(now).toISOString(), autoApprovesAt: now + VIEWER_REQUEST_AUTO_APPROVE_MS });
    return serializeMockStage(stage);
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/guests/requests/:requestId/:decision", ({ params }) => {
    const stage = requireHostedStage(params.liveId!);
    const request = stage.joinRequests.find((candidate) => candidate.id === params.requestId);
    if (!request || request.state !== "pending") throw new ApiError(410, "This request is no longer waiting.");
    if (params.decision === "approve") addGuestToMockStageOrThrow(stage, request.user);
    request.state = params.decision === "approve" ? "approved" : "declined";
    return serializeMockStage(stage);
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/guests/:userId/remove", ({ params }) => {
    const stage = requireHostedStage(params.liveId!);
    findStreamerOrThrow(stage, params.userId!);
    removeStreamerFromMockStage(stage, params.userId!, Date.now(), true);
    return serializeMockStage(stage);
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/guests/:userId/mute", ({ params, body }) => {
    const stage = findOrCreateMockStageAdvancedToNow(params.liveId!);
    const userId = resolveUserIdAlias(params.userId!);
    if (!stage.isHostedByMe && userId !== signedInMockUserSummary().id) throw new ApiError(403, "Only the host can mute other guests.");
    const streamer = findStreamerOrThrow(stage, userId);
    const { audio, video } = body as MuteStreamerInput;
    stage.streamers = stage.streamers.map((candidate) =>
      candidate === streamer ? { ...candidate, audioMuted: audio ?? candidate.audioMuted, videoMuted: video ?? candidate.videoMuted } : candidate,
    );
    return serializeMockStage(stage);
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/guests/me/leave", ({ params }) => {
    const stage = findOrCreateMockStageAdvancedToNow(params.liveId!);
    removeStreamerFromMockStage(stage, signedInMockUserSummary().id, Date.now(), false);
    return serializeMockStage(stage);
  }),
];
