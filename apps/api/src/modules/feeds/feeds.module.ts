import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { RecordFeedInteractionHandler } from "./commands/recordFeedInteraction/recordFeedInteraction.handler.js";
import { GetFollowingFeedHandler } from "./queries/getFollowingFeed/getFollowingFeed.handler.js";
import { GetForYouFeedHandler } from "./queries/getForYouFeed/getForYouFeed.handler.js";
import { GetSuggestedClipsHandler } from "./queries/getSuggestedClips/getSuggestedClips.handler.js";
import type { FeedsService } from "./services/feeds.service.js";

export class FeedsModule extends BaseModule {
  public readonly id = "feeds";
  public readonly name = "feeds";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("feeds module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("feeds module stopped");
  }
}

export function registerFeedsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, feedsService: FeedsService): void {
  registerCommandHandlers(commands, [new RecordFeedInteractionHandler(feedsService)]);
  registerQueryHandlers(queries, [
    new GetForYouFeedHandler(feedsService),
    new GetFollowingFeedHandler(feedsService),
    new GetSuggestedClipsHandler(feedsService),
  ]);
}
