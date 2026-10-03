import type { LiveBattleProposal } from "@/types/liveStage.type";

import { willSimulatedStreamerDeclineWinnerTakesAll, type MockBattleProposal, type MockStage } from "./liveStageSeeds.mock";

const SIMULATED_HOST_DECISION_DELAY_MS = 2_000;

type StartBattleFromProposal = (proposal: MockBattleProposal, winnerTakesAll: boolean, startedAt: number) => void;

const applySimulatedConsents = (proposal: MockBattleProposal, now: number, myUserId: string) => {
  for (const [userId, state] of proposal.consents) {
    if (state !== "pending") continue;
    if (now >= proposal.expiresAt) proposal.consents.set(userId, "declined");
    else if (userId !== myUserId && now >= proposal.simulatedResponseAt)
      proposal.consents.set(userId, willSimulatedStreamerDeclineWinnerTakesAll(userId) ? "declined" : "accepted");
  }
};

export const resolveMockBattleProposalIfDue = (stage: MockStage, now: number, myUserId: string, startBattle: StartBattleFromProposal) => {
  const proposal = stage.battleProposal;
  if (!proposal) return;
  applySimulatedConsents(proposal, now, myUserId);
  const states = [...proposal.consents.values()];
  if (states.every((state) => state === "accepted")) return startBattle(proposal, true, now);
  if (!states.includes("declined")) return;
  proposal.hostDecisionAt ??= now;
  if (!stage.isHostedByMe && now >= proposal.hostDecisionAt + SIMULATED_HOST_DECISION_DELAY_MS) startBattle(proposal, false, now);
};

export const serializeMockBattleProposal = (proposal: MockBattleProposal): LiveBattleProposal => ({
  id: proposal.id,
  winnerTakesAll: true,
  durationSeconds: proposal.durationSeconds,
  participants: proposal.participants,
  consents: [...proposal.consents].map(([userId, state]) => ({ userId, state })),
  expiresAt: new Date(proposal.expiresAt).toISOString(),
  needsHostDecision: proposal.hostDecisionAt !== null,
});
