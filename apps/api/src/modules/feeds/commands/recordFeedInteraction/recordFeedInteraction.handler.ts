import { CommandHandler } from "@zudojs/cqrs";

import type { FeedsService } from "../../services/feeds.service.js";
import type { RecordFeedInteractionCommand } from "./recordFeedInteraction.command.js";

export class RecordFeedInteractionHandler extends CommandHandler<RecordFeedInteractionCommand, void> {
  public readonly commandType = "feeds.recordFeedInteraction" as const;

  public constructor(private readonly feedsService: FeedsService) {
    super();
  }

  public async execute(command: RecordFeedInteractionCommand): Promise<void> {
    const { postsService, feedInteractions, clock } = this.feedsService.dependencies;
    const post = await postsService.findVisiblePostOrThrow(command.postId, command.principal.userId);
    await feedInteractions.record(command.principal.userId, post.id, command.kind, clock.now());
    if (command.kind === "view") await postsService.dependencies.posts.changeCounter(post.id, "viewCount", 1);
    if (command.kind === "share") await postsService.dependencies.posts.changeCounter(post.id, "shareCount", 1);
  }
}
