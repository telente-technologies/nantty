import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { PostsService } from "../../services/posts.service.js";
import type { MarkStorySeenCommand } from "./markStorySeen.command.js";

export class MarkStorySeenHandler extends CommandHandler<MarkStorySeenCommand, void> {
  public readonly commandType = "posts.markStorySeen" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(command: MarkStorySeenCommand): Promise<void> {
    const story = await this.postsService.findVisiblePostOrThrow(command.storyId, command.principal.userId);
    if (story.kind !== "story") throw notFound("Story");
    await this.postsService.dependencies.engagement.markStorySeen(story.id, command.principal.userId);
  }
}
