import { ApiError } from "@/errors/api.error";
import type { UserSummary } from "@/types";
import { MAXIMUM_STREAMERS_ON_STAGE, type LiveStage, type LiveStagePhase } from "@/types/liveStage.type";

import { getSignedInMockUser } from "./fixtures.mock";
import {
  createMockBattle,
  describeMockBattleStateAt,
  forfeitMockBattleParticipant,
  serializeMockBattle,
  settleMockBattleIfDue,
  simulateViewerContributionsUntil,
} from "./liveBattleEngine.mock";
import { resolveMockBattleProposalIfDue, serializeMockBattleProposal } from "./liveBattleProposal.mock";
import {
  buildStreamer,
  HOST_INVITES_VIEWER_AFTER_MS,
  INVITE_EXPIRY_MS,
  mockAudienceUser,
  readMockLiveSession,
  seededGuestCountForLive,
  SIMULATED_JOIN_REQUEST_OFFSETS_MS,
  type MockGuestSlot,
  type MockStage,
} from "./liveStageSeeds.mock";
import { summariseUser } from "./userDirectory.mock";

const AUTO_BATTLE_FIRST_DELAY_MS = 5_000;
const AUTO_BATTLE_REPEAT_DELAY_MS = 8_000;
const AUTO_BATTLE_DURATION_SECONDS = 60;
const BATTLE_HISTORY_LIMIT = 5;

const stagesByLiveId = new Map<string, MockStage>();
const liveIdByBattleId = new Map<string, string>();

export const signedInMockUserSummary = (): UserSummary => summariseUser(getSignedInMockUser());

const nextSlotId = (stage: MockStage) => `slot_${stage.liveId}_${(stage.slotsCreated += 1)}`;

const createMockStage = (liveId: string, now: number): MockStage => {
  const session = readMockLiveSession(liveId);
  const isHostedByMe = session.host.id === signedInMockUserSummary().id;
  const stage: MockStage = {
    liveId,
    host: session.host,
    isHostedByMe,
    openedAt: now,
    streamers: [],
    invitations: [],
    joinRequests: [],
    battleProposal: null,
    battle: null,
    battleHistory: [],
    recentBattleGifts: [],
    battlesStarted: 0,
    slotsCreated: 0,
    nextAutoBattleAt: isHostedByMe ? null : now + AUTO_BATTLE_FIRST_DELAY_MS,
    hasHostInvitedMe: false,
    simulatedJoinRequestsSent: 0,
  };
  const seededGuests = isHostedByMe ? [] : Array.from({ length: seededGuestCountForLive(liveId) }, (_, index) => mockAudienceUser(index));
  stage.streamers = [buildStreamer(session.host, "host", nextSlotId(stage)), ...seededGuests.map((guest) => buildStreamer(guest, "guest", nextSlotId(stage)))];
  return stage;
};

export const isStreamerOnMockStage = (stage: MockStage, userId: string) => stage.streamers.some((streamer) => streamer.user.id === userId);

export const countReservedStageSeats = (stage: MockStage) =>
  stage.streamers.length + stage.invitations.filter((slot) => slot.state === "invited" && !slot.isForMe).length;

export const addGuestToMockStageOrThrow = (stage: MockStage, user: UserSummary, slotId = nextSlotId(stage)) => {
  if (isStreamerOnMockStage(stage, user.id)) return;
  if (stage.streamers.length >= MAXIMUM_STREAMERS_ON_STAGE) throw new ApiError(409, "The stage is full. Up to 10 people can be on stage.", "STAGE_FULL");
  stage.streamers.push(buildStreamer(user, "guest", slotId));
};

export const removeStreamerFromMockStage = (stage: MockStage, userId: string, now: number, isRemovedByHost: boolean) => {
  stage.streamers = stage.streamers.filter((streamer) => streamer.user.id !== userId || streamer.role === "host");
  if (stage.battle) forfeitMockBattleParticipant(stage.battle, userId, now, isRemovedByHost);
  if (stage.battleProposal) stage.battleProposal.consents.set(userId, "declined");
};

export const findMockStageByBattleIdOrThrow = (battleId: string) => {
  const liveId = liveIdByBattleId.get(battleId);
  if (!liveId) throw new ApiError(404, "Battle not found");
  return findOrCreateMockStageAdvancedToNow(liveId);
};

export const startMockBattleOnStage = (stage: MockStage, participants: readonly UserSummary[], winnerTakesAll: boolean, durationSeconds: number, now: number, battleId?: string) => {
  stage.battlesStarted += 1;
  stage.recentBattleGifts = [];
  stage.battleProposal = null;
  const isMember = (user: UserSummary) => stage.streamers.find((streamer) => streamer.user.id === user.id)?.isCreatorProgramMember ?? false;
  const battle = createMockBattle({
    liveId: stage.liveId,
    participants: participants.map((user) => ({ user, isCreatorProgramMember: isMember(user) })),
    winnerTakesAll,
    durationSeconds,
    now,
    sequence: stage.battlesStarted,
  });
  stage.battle = battleId ? { ...battle, id: battleId } : battle;
  liveIdByBattleId.set(stage.battle.id, stage.liveId);
};

export const proposeOrStartMockBattle = (stage: MockStage, participants: readonly UserSummary[], winnerTakesAll: boolean, durationSeconds: number, now: number) => {
  const guestsWhoMustAccept = participants.filter((user) => user.id !== stage.host.id);
  if (!winnerTakesAll || guestsWhoMustAccept.length === 0) return startMockBattleOnStage(stage, participants, winnerTakesAll, durationSeconds, now);
  const id = `battle_${now.toString(36)}_${stage.battlesStarted + 1}`;
  liveIdByBattleId.set(id, stage.liveId);
  stage.battleProposal = {
    id,
    durationSeconds,
    participants: [...participants],
    consents: new Map(guestsWhoMustAccept.map((user) => [user.id, "pending"])),
    simulatedResponseAt: now + 2_000,
    expiresAt: now + 15_000,
    hostDecisionAt: null,
  };
};

const resolveDueInvitationsAndRequests = (stage: MockStage, now: number) => {
  const myUserId = signedInMockUserSummary().id;
  for (const slot of stage.invitations) {
    if (slot.state !== "invited") continue;
    if (now >= Date.parse(slot.expiresAt)) slot.state = "expired";
    if (slot.state !== "invited" || slot.isForMe || now < slot.resolvesAt) continue;
    slot.state = slot.willAccept && stage.streamers.length < MAXIMUM_STREAMERS_ON_STAGE ? "onStage" : "declined";
    if (slot.state === "onStage") addGuestToMockStageOrThrow(stage, slot.user, slot.id);
  }
  for (const request of stage.joinRequests) {
    if (request.state !== "pending" || request.autoApprovesAt === null || now < request.autoApprovesAt) continue;
    const hasRoom = stage.streamers.length < MAXIMUM_STREAMERS_ON_STAGE;
    request.state = hasRoom ? "approved" : "declined";
    if (hasRoom) addGuestToMockStageOrThrow(stage, request.user);
  }
  if (!stage.isHostedByMe && !stage.hasHostInvitedMe && !isStreamerOnMockStage(stage, myUserId) && now >= stage.openedAt + HOST_INVITES_VIEWER_AFTER_MS) {
    stage.hasHostInvitedMe = true;
    stage.invitations.push(buildMockGuestSlot(stage, signedInMockUserSummary(), now, { resolvesAt: Number.POSITIVE_INFINITY, willAccept: false, isForMe: true }));
  }
  while (stage.isHostedByMe && stage.simulatedJoinRequestsSent < SIMULATED_JOIN_REQUEST_OFFSETS_MS.length) {
    const requestAt = stage.openedAt + SIMULATED_JOIN_REQUEST_OFFSETS_MS[stage.simulatedJoinRequestsSent]!;
    if (now < requestAt) break;
    const requester = mockAudienceUser(16 + stage.simulatedJoinRequestsSent);
    stage.simulatedJoinRequestsSent += 1;
    if (isStreamerOnMockStage(stage, requester.id)) continue;
    stage.joinRequests.push({ id: `jr_${requestAt.toString(36)}`, user: requester, state: "pending", requestedAt: new Date(requestAt).toISOString(), autoApprovesAt: null });
  }
};

export const buildMockGuestSlot = (stage: MockStage, user: UserSummary, now: number, simulation: Pick<MockGuestSlot, "resolvesAt" | "willAccept" | "isForMe">): MockGuestSlot => ({
  id: nextSlotId(stage),
  liveId: stage.liveId,
  user,
  state: "invited",
  invitedAt: new Date(now).toISOString(),
  expiresAt: new Date(now + INVITE_EXPIRY_MS).toISOString(),
  audioMutedByHost: false,
  videoMutedByHost: false,
  position: stage.streamers.length,
  ...simulation,
});

const dropLastSimulatedGuestHalfwayThroughBigBattles = (stage: MockStage, now: number) => {
  const battle = stage.battle;
  if (!battle || battle.participants.length < 4) return;
  const dropAt = battle.startsAt + battle.durationSeconds * 500;
  const leaver = battle.participants[battle.participants.length - 1]!;
  const isSimulatedGuest = leaver.user.id !== stage.host.id && leaver.user.id !== signedInMockUserSummary().id;
  if (now < dropAt || !isSimulatedGuest || leaver.state !== "active" || !isStreamerOnMockStage(stage, leaver.user.id)) return;
  simulateViewerContributionsUntil(battle, dropAt);
  removeStreamerFromMockStage(stage, leaver.user.id, dropAt, false);
};

const advanceBattleAndArchiveWhenDone = (stage: MockStage, now: number) => {
  const battle = stage.battle;
  if (!battle) return;
  dropLastSimulatedGuestHalfwayThroughBigBattles(stage, now);
  simulateViewerContributionsUntil(battle, now);
  settleMockBattleIfDue(battle, now, stage.host.id);
  if (describeMockBattleStateAt(battle, now) !== "archived") return;
  stage.battleHistory = [serializeMockBattle(battle, now), ...stage.battleHistory].slice(0, BATTLE_HISTORY_LIMIT);
  stage.battle = null;
  if (!stage.isHostedByMe) stage.nextAutoBattleAt = now + AUTO_BATTLE_REPEAT_DELAY_MS;
};

const startAutoBattleWhenDue = (stage: MockStage, now: number) => {
  if (stage.isHostedByMe || stage.battle || stage.battleProposal || stage.nextAutoBattleAt === null || now < stage.nextAutoBattleAt) return;
  if (stage.streamers.length < 2) return;
  stage.nextAutoBattleAt = null;
  proposeOrStartMockBattle(stage, stage.streamers.map((streamer) => streamer.user), stage.battlesStarted % 2 === 1, AUTO_BATTLE_DURATION_SECONDS, now);
};

export const findOrCreateMockStageAdvancedToNow = (liveId: string, now = Date.now()) => {
  const stage = stagesByLiveId.get(liveId) ?? createMockStage(liveId, now);
  stagesByLiveId.set(liveId, stage);
  resolveDueInvitationsAndRequests(stage, now);
  resolveMockBattleProposalIfDue(stage, now, signedInMockUserSummary().id, (proposal, winnerTakesAll, startedAt) => {
    const participantsStillOnStage = proposal.participants.filter((user) => isStreamerOnMockStage(stage, user.id));
    if (participantsStillOnStage.length < 2) stage.battleProposal = null;
    else startMockBattleOnStage(stage, participantsStillOnStage, winnerTakesAll, proposal.durationSeconds, startedAt, proposal.id);
  });
  advanceBattleAndArchiveWhenDone(stage, now);
  startAutoBattleWhenDue(stage, now);
  return stage;
};

const describeStagePhase = (stage: MockStage, now: number): LiveStagePhase => {
  if (stage.battleProposal) return "battlePending";
  const battleState = stage.battle ? describeMockBattleStateAt(stage.battle, now) : "archived";
  if (battleState === "countdown") return "battleCountdown";
  if (battleState === "active") return "battling";
  if (battleState === "settling") return "settling";
  if (battleState === "settled") return "result";
  if (stage.streamers.length > 1) return "onStage";
  return stage.invitations.some((slot) => slot.state === "invited" && !slot.isForMe) ? "inviting" : "idle";
};

const stripSimulationFields = ({ resolvesAt: _r, willAccept: _w, isForMe: _f, ...slot }: MockGuestSlot) => slot;

export const serializeMockStage = (stage: MockStage, now = Date.now()): LiveStage => {
  const myUserId = signedInMockUserSummary().id;
  const invitationForMe = stage.invitations.find((slot) => slot.isForMe && slot.state === "invited");
  const myJoinRequest = [...stage.joinRequests].reverse().find((request) => request.user.id === myUserId);
  return {
    liveId: stage.liveId,
    layout: stage.battle ? "battle" : stage.streamers.length === 1 ? "spotlight" : "grid",
    phase: describeStagePhase(stage, now),
    serverNow: new Date(now).toISOString(),
    myRole: stage.isHostedByMe ? "host" : isStreamerOnMockStage(stage, myUserId) ? "guest" : "viewer",
    streamers: stage.streamers.map((streamer, position) => ({ ...streamer, position })),
    invitations: stage.invitations.filter((slot) => !slot.isForMe).map(stripSimulationFields),
    joinRequests: stage.joinRequests.filter((request) => request.state === "pending").map(({ autoApprovesAt: _a, ...request }) => request),
    invitationForMe: invitationForMe ? stripSimulationFields(invitationForMe) : null,
    myJoinRequest: myJoinRequest ? (({ autoApprovesAt: _a, ...request }) => request)(myJoinRequest) : null,
    battleProposal: stage.battleProposal ? serializeMockBattleProposal(stage.battleProposal) : null,
    activeBattle: stage.battle ? serializeMockBattle(stage.battle, now) : null,
    recentBattleGifts: [...stage.recentBattleGifts],
    battleHistory: stage.battleHistory,
  };
};
