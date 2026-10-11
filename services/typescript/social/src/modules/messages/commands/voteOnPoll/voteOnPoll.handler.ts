import type { Handler } from "../../../../types/handlerContext.type.js";
import { rejectLegacyPlaintextEndpoint } from "../../services/liveLocation.service.js";
import type { VoteOnPollCommand } from "./voteOnPoll.command.js";

export function createVoteOnPollHandler(): Handler<VoteOnPollCommand, never> {
  return async () => rejectLegacyPlaintextEndpoint("pollVotes");
}
