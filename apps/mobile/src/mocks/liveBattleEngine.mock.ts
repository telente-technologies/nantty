import type { UserSummary } from "@/types";
import type { LiveBattle, LiveBattleEndReason, LiveBattleState, LiveBattleTransfer } from "@/types/liveStage.type";

import {
  BATTLE_COUNTDOWN_MS,
  BATTLE_RESULT_MS,
  BATTLE_SETTLING_MS,
  createSeededRandom,
  hashTextToSeed,
  mockAudienceUser,
  type MockBattle,
  type MockBattleParticipant,
  type MockBattleSettlement,
} from "./liveStageSeeds.mock";

const LAST_SECONDS_FRENZY = 10;
const MOMENTUM_WINDOW_SECONDS = 15;
const SIMULATED_SUPPORTER_POOL = 14;

const toIso = (time: number) => new Date(time).toISOString();

export const createMockBattle = (input: { liveId: string; participants: readonly { user: UserSummary; isCreatorProgramMember: boolean }[]; winnerTakesAll: boolean; durationSeconds: number; now: number; sequence: number }) => {
  const startsAt = input.now + BATTLE_COUNTDOWN_MS;
  const endsAt = startsAt + input.durationSeconds * 1000;
  const battle: MockBattle = {
    id: `battle_${input.now.toString(36)}_${input.sequence}`,
    liveId: input.liveId,
    winnerTakesAll: input.winnerTakesAll,
    durationSeconds: input.durationSeconds,
    countdownStartedAt: input.now,
    startsAt,
    endsAt,
    settledAt: endsAt + BATTLE_SETTLING_MS,
    celebrationEndsAt: endsAt + BATTLE_SETTLING_MS + BATTLE_RESULT_MS,
    endReason: null,
    simulatedThroughSecond: 0,
    participants: input.participants.map(({ user, isCreatorProgramMember }) => ({ user, isCreatorProgramMember, score: 0, state: "active", keepsOwnCoinsUnderWinnerTakesAll: false, gifters: new Map() })),
    settlement: null,
  };
  return battle;
};

export const describeMockBattleStateAt = (battle: MockBattle, now: number): LiveBattleState | "archived" => {
  if (now < battle.startsAt) return "countdown";
  if (now < battle.endsAt) return "active";
  if (now < battle.settledAt) return "settling";
  if (now < battle.celebrationEndsAt) return "settled";
  return "archived";
};

export const creditBattleCoinsToParticipant = (battle: MockBattle, contribution: { readonly sender: UserSummary; readonly recipientUserId: string; readonly coins: number }) => {
  const participant = battle.participants.find((candidate) => candidate.user.id === contribution.recipientUserId);
  if (!participant || participant.state !== "active") return false;
  participant.score += contribution.coins;
  const supporter = participant.gifters.get(contribution.sender.id);
  participant.gifters.set(contribution.sender.id, { userId: contribution.sender.id, user: contribution.sender, coins: (supporter?.coins ?? 0) + contribution.coins });
  return true;
};

const pickMomentumWeightedRecipient = (battle: MockBattle, second: number, random: () => number) => {
  const activeParticipants = battle.participants.filter((participant) => participant.state === "active");
  const favouredIndex = Math.abs(Math.floor(second / MOMENTUM_WINDOW_SECONDS) + hashTextToSeed(battle.id)) % Math.max(1, activeParticipants.length);
  const weights = activeParticipants.map((_, index) => (index === favouredIndex ? 3 : 1));
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < activeParticipants.length; index++) {
    roll -= weights[index]!;
    if (roll <= 0) return activeParticipants[index]!;
  }
  return activeParticipants[0];
};

export const simulateViewerContributionsUntil = (battle: MockBattle, now: number) => {
  const lastSecond = Math.floor((Math.min(now, battle.endsAt) - battle.startsAt) / 1000);
  for (let second = battle.simulatedThroughSecond + 1; second <= lastSecond; second++) {
    const random = createSeededRandom(hashTextToSeed(battle.id) + second * 7919);
    const isFrenzy = battle.durationSeconds - second < LAST_SECONDS_FRENZY;
    const roll = random();
    const contributionCount = isFrenzy ? (roll < 0.5 ? 3 : 2) : roll < 0.55 ? 1 : roll < 0.7 ? 2 : 0;
    for (let index = 0; index < contributionCount; index++) {
      const recipient = pickMomentumWeightedRecipient(battle, second, random);
      if (!recipient) continue;
      const contributionAmounts = [10, 25, 50, 100] as const;
      const coins = contributionAmounts[Math.floor(random() * contributionAmounts.length)]!;
      creditBattleCoinsToParticipant(battle, { sender: mockAudienceUser(Math.floor(random() * SIMULATED_SUPPORTER_POOL)), recipientUserId: recipient.user.id, coins });
    }
  }
  battle.simulatedThroughSecond = Math.max(battle.simulatedThroughSecond, lastSecond);
};

const listTopGifters = (participant: MockBattleParticipant) => [...participant.gifters.values()].sort((a, b) => b.coins - a.coins).slice(0, 3);

const buildWinnerTakesAllTransfers = (participants: readonly MockBattleParticipant[], winner: MockBattleParticipant): LiveBattleTransfer[] =>
  participants
    .filter((participant) => participant !== winner && !participant.keepsOwnCoinsUnderWinnerTakesAll && participant.score > 0)
    .map((loser) => ({ fromUserId: loser.user.id, toUserId: winner.user.id, coins: loser.score }));

export const settleMockBattle = (participants: readonly MockBattleParticipant[], winnerTakesAll: boolean, hostUserId: string): MockBattleSettlement => {
  const activeParticipants = participants.filter((participant) => participant.state === "active");
  const topScore = Math.max(0, ...activeParticipants.map((participant) => participant.score));
  const leaders = topScore > 0 ? activeParticipants.filter((participant) => participant.score === topScore) : [];
  const winner = leaders.length === 1 ? leaders[0]! : null;
  const transfers = winnerTakesAll && winner ? buildWinnerTakesAllTransfers(participants, winner) : [];
  const isMovedByWinnerTakesAll = (participant: MockBattleParticipant) => transfers.some((transfer) => transfer.fromUserId === participant.user.id);
  const receivedByTransfer = (userId: string) => transfers.filter((transfer) => transfer.toUserId === userId).reduce((sum, transfer) => sum + transfer.coins, 0);
  return {
    winnerUserIds: leaders.map((leader) => leader.user.id),
    isTie: winner === null,
    transfers,
    payouts: participants.map((participant) => ({
      userId: participant.user.id,
      score: participant.score,
      earnedCoins: (isMovedByWinnerTakesAll(participant) ? 0 : participant.score) + receivedByTransfer(participant.user.id),
      paidToUserId: participant.isCreatorProgramMember ? participant.user.id : hostUserId,
    })),
    mvpGifter: winner ? (listTopGifters(winner)[0] ?? null) : null,
  };
};

export const finishMockBattleEarly = (battle: MockBattle, now: number, endReason: LiveBattleEndReason) => {
  if (now >= battle.endsAt) return;
  battle.endReason = endReason;
  battle.endsAt = Math.max(now, battle.startsAt);
  battle.settledAt = battle.endsAt + BATTLE_SETTLING_MS;
  battle.celebrationEndsAt = battle.settledAt + BATTLE_RESULT_MS;
};

export const forfeitMockBattleParticipant = (battle: MockBattle, userId: string, now: number, isRemovedByHost: boolean) => {
  const participant = battle.participants.find((candidate) => candidate.user.id === userId);
  if (!participant || participant.state !== "active" || now >= battle.endsAt) return;
  participant.state = isRemovedByHost ? "left" : "forfeited";
  participant.keepsOwnCoinsUnderWinnerTakesAll = isRemovedByHost;
  if (battle.participants.filter((candidate) => candidate.state === "active").length < 2) finishMockBattleEarly(battle, now, "forfeit");
};

export const settleMockBattleIfDue = (battle: MockBattle, now: number, hostUserId: string) => {
  if (battle.settlement || now < battle.endsAt) return;
  battle.endReason ??= "timer";
  battle.settlement = settleMockBattle(battle.participants, battle.winnerTakesAll, hostUserId);
};

const rankOfScore = (battle: MockBattle, participant: MockBattleParticipant) => {
  if (participant.state !== "active") return 0;
  const distinctScores = [...new Set(battle.participants.filter((candidate) => candidate.state === "active").map((candidate) => candidate.score))].sort((a, b) => b - a);
  return distinctScores.indexOf(participant.score) + 1;
};

export const serializeMockBattle = (battle: MockBattle, now: number): LiveBattle => {
  const state = describeMockBattleStateAt(battle, now);
  const settlement = state === "settled" || state === "archived" ? battle.settlement : null;
  return {
    id: battle.id,
    liveId: battle.liveId,
    state: state === "archived" ? "settled" : state,
    winnerTakesAll: battle.winnerTakesAll,
    durationSeconds: battle.durationSeconds,
    countdownStartedAt: toIso(battle.countdownStartedAt),
    startsAt: toIso(battle.startsAt),
    endsAt: toIso(battle.endsAt),
    settledAt: settlement ? toIso(battle.settledAt) : null,
    celebrationEndsAt: toIso(battle.celebrationEndsAt),
    participants: battle.participants.map((participant) => ({
      userId: participant.user.id,
      user: participant.user,
      score: participant.score,
      rank: rankOfScore(battle, participant),
      state: participant.state,
      topGifters: listTopGifters(participant),
    })),
    winnerUserIds: settlement?.winnerUserIds ?? [],
    isTie: settlement?.isTie ?? false,
    endReason: now >= battle.endsAt ? battle.endReason : null,
    mvpGifter: settlement?.mvpGifter ?? null,
    transfers: settlement?.transfers ?? [],
    payouts: settlement?.payouts ?? [],
  };
};
