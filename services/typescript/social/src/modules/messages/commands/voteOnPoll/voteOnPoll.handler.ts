import { notFound, unprocessable } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { MessagePollView } from "../../models/message.model.js";
import { messageRepository } from "../../repositories/message.repository.js";
import { loadMessageForMember } from "../../services/messageAccess.service.js";
import { buildPollView } from "../../services/messageView.service.js";
import type { VoteOnPollCommand } from "./voteOnPoll.command.js";

export function createVoteOnPollHandler(context: HandlerContext): Handler<VoteOnPollCommand, MessagePollView> {
  return async ({ viewerId, messageId, optionId }) => {
    const message = await loadMessageForMember(context, messageId, viewerId);
    if (message.kind !== "poll") throw unprocessable("NOT_A_POLL", "This message isn't a poll.");
    await context.database.transaction(async (transaction) => {
      if ((await messageRepository.findOption(transaction, messageId, optionId)) === null) throw notFound("POLL_OPTION_NOT_FOUND", "Option not found.");
      if ((await messageRepository.findVote(transaction, optionId, viewerId)) !== null) {
        await messageRepository.removeVote(transaction, optionId, viewerId);
        return;
      }
      if (!message.pollAllowMultiple) await messageRepository.removeVotesForMessage(transaction, messageId, viewerId);
      await messageRepository.addVote(transaction, optionId, messageId, viewerId);
    });
    const poll = buildPollView(await loadMessageForMember(context, messageId, viewerId));
    return poll as MessagePollView;
  };
}
