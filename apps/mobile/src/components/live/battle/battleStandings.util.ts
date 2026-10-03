import type { LiveBattle } from "@/types/liveStage.type";

import type { LiveStageTileBattleBadge } from "../guests/liveStageTile";

export const findSingleBattleWinner = (battle: LiveBattle) =>
  battle.state === "settled" && !battle.isTie ? (battle.participants.find((participant) => participant.userId === battle.winnerUserIds[0]) ?? null) : null;

export const buildBattleBadgeForStreamer = (battle: LiveBattle | null, userId: string): LiveStageTileBattleBadge | null => {
  const participant = battle?.participants.find((candidate) => candidate.userId === userId);
  if (!battle || !participant) return null;
  const winner = findSingleBattleWinner(battle);
  const isWinner = winner?.userId === userId;
  return {
    participant,
    rank: battle.participants.length > 2 && participant.rank > 0 ? participant.rank : null,
    isWinner,
    isDimmed: participant.state !== "active" || (winner !== null && !isWinner),
  };
};

export const describeBattleRule = (winnerTakesAll: boolean) => (winnerTakesAll ? "Winner takes all" : "Everyone keeps their coins");

export const isBattleStillRunning = (battle: LiveBattle | null) => battle?.state === "countdown" || battle?.state === "active";
