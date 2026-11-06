import { ApiError } from "@/errors/api.error";
import type { CreateLiveBattleInput, SendLiveBattleCoinsInput } from "@/types/liveStage.type";

import { creditBattleCoinsToParticipant, describeMockBattleStateAt, finishMockBattleEarly } from "./liveBattleEngine.mock";
import {
  findMockStageByBattleIdOrThrow,
  findOrCreateMockStageAdvancedToNow,
  proposeOrStartMockBattle,
  serializeMockStage,
  signedInMockUserSummary,
  startMockBattleOnStage,
} from "./liveStageStore.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const MINIMUM_BATTLE_SECONDS = 60;
const MAXIMUM_BATTLE_SECONDS = 600;

const requireHostedStageForBattle = (battleId: string) => {
  const stage = findMockStageByBattleIdOrThrow(battleId);
  if (!stage.isHostedByMe) throw new ApiError(403, "Only the host can do that.");
  return stage;
};

const requirePendingProposal = (battleId: string) => {
  const stage = findMockStageByBattleIdOrThrow(battleId);
  if (stage.battleProposal?.id !== battleId) throw new ApiError(410, "This battle is no longer waiting for answers.");
  return { stage, proposal: stage.battleProposal };
};

export const liveBattleMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/lives/:liveId/battles", ({ params, body }) => {
    const stage = findOrCreateMockStageAdvancedToNow(params.liveId!);
    if (!stage.isHostedByMe) throw new ApiError(403, "Only the host can start a battle.");
    if (stage.battle || stage.battleProposal) throw new ApiError(409, "A battle is already running.");
    const input = body as CreateLiveBattleInput;
    if (input.durationSeconds < MINIMUM_BATTLE_SECONDS || input.durationSeconds > MAXIMUM_BATTLE_SECONDS) throw new ApiError(400, "Pick between 1 and 10 minutes.");
    const participants = stage.streamers.filter((streamer) => input.participantUserIds.includes(streamer.user.id)).map((streamer) => streamer.user);
    if (participants.length < 2) throw new ApiError(400, "A battle needs at least 2 people on stage.");
    proposeOrStartMockBattle(stage, participants, input.winnerTakesAll, input.durationSeconds, Date.now());
    return serializeMockStage(stage);
  }),
  createMockRoute("POST", "/api/v1/battles/:battleId/cancel", ({ params }) => {
    requireHostedStageForBattle(params.battleId!);
    const { stage } = requirePendingProposal(params.battleId!);
    stage.battleProposal = null;
    return serializeMockStage(stage);
  }),
  createMockRoute("POST", "/api/v1/battles/:battleId/start-without-winner-takes-all", ({ params }) => {
    requireHostedStageForBattle(params.battleId!);
    const { stage, proposal } = requirePendingProposal(params.battleId!);
    const participants = proposal.participants.filter((user) => stage.streamers.some((streamer) => streamer.user.id === user.id));
    if (participants.length < 2) throw new ApiError(400, "Not enough streamers are still on stage.");
    startMockBattleOnStage(stage, participants, false, proposal.durationSeconds, Date.now(), proposal.id);
    return serializeMockStage(stage);
  }),
  createMockRoute("POST", "/api/v1/battles/:battleId/end", ({ params }) => {
    const stage = requireHostedStageForBattle(params.battleId!);
    if (stage.battle?.id !== params.battleId) throw new ApiError(410, "This battle has already ended.");
    finishMockBattleEarly(stage.battle, Date.now(), "hostEnded");
    return serializeMockStage(findOrCreateMockStageAdvancedToNow(stage.liveId));
  }),
  createMockRoute("POST", "/api/v1/battles/:battleId/coins", ({ params, body }) => {
    const stage = findMockStageByBattleIdOrThrow(params.battleId!);
    const battle = stage.battle;
    const input = body as SendLiveBattleCoinsInput;
    if (!Number.isSafeInteger(input.coins) || input.coins <= 0) throw new ApiError(400, "Enter a positive whole number of coins.");
    if (battle?.id === params.battleId && describeMockBattleStateAt(battle, Date.now()) === "active")
      creditBattleCoinsToParticipant(battle, { sender: signedInMockUserSummary(), recipientUserId: input.recipientUserId, coins: input.coins });
    return serializeMockStage(stage);
  }),
  ...(["accept", "decline"] as const).map((consent) =>
    createMockRoute("POST", `/api/v1/battles/:battleId/${consent}`, ({ params }) => {
      const { stage, proposal } = requirePendingProposal(params.battleId!);
      const myUserId = signedInMockUserSummary().id;
      if (proposal.consents.get(myUserId) !== "pending") throw new ApiError(409, "You already answered.");
      proposal.consents.set(myUserId, consent === "accept" ? "accepted" : "declined");
      return serializeMockStage(findOrCreateMockStageAdvancedToNow(stage.liveId));
    }),
  ),
];
