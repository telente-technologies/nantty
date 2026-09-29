import { CommandHandler, type CommandBus } from "@zudojs/cqrs";

import { notFound, unprocessable } from "../../../../errors/domain.error.js";
import { SendMessageCommand } from "../../../messages/commands/sendMessage/sendMessage.command.js";
import { StartConversationCommand } from "../../../messages/commands/startConversation/startConversation.command.js";
import type { PostsService } from "../../services/posts.service.js";
import type { ReplyToStoryCommand } from "./replyToStory.command.js";

export class ReplyToStoryHandler extends CommandHandler<ReplyToStoryCommand, { readonly conversationId: string }> {
  public readonly commandType = "posts.replyToStory" as const;

  public constructor(private readonly postsService: PostsService, private readonly commands: CommandBus) {
    super();
  }

  public async execute(command: ReplyToStoryCommand): Promise<{ readonly conversationId: string }> {
    const userId = command.principal.userId;
    const story = await this.postsService.findVisiblePostOrThrow(command.storyId, userId);
    if (story.kind !== "story") throw notFound("Story");
    if (story.authorId === userId) throw unprocessable("You cannot reply to your own story.");
    await this.postsService.assertUsersAreNotBlocked(userId, story.authorId);
    const conversation = await this.commands.execute<StartConversationCommand, { readonly id: string }>(new StartConversationCommand(command.principal, story.authorId));
    await this.commands.execute<SendMessageCommand, unknown>(
      new SendMessageCommand(command.principal, conversation.id, { text: `Replied to your story: ${command.text.trim()}` }),
    );
    return { conversationId: conversation.id };
  }
}
