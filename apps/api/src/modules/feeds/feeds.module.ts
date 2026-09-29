import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { RecordFeedFeedbackHandler } from "./commands/recordFeedFeedback/recordFeedFeedback.handler.js";
import { RecordFeedInteractionHandler } from "./commands/recordFeedInteraction/recordFeedInteraction.handler.js";
import { RecordProductInteractionHandler } from "./commands/recordProductInteraction/recordProductInteraction.handler.js";
import { GetFollowingFeedHandler } from "./queries/getFollowingFeed/getFollowingFeed.handler.js";
import { GetForYouFeedHandler } from "./queries/getForYouFeed/getForYouFeed.handler.js";
import { GetSuggestedClipsHandler } from "./queries/getSuggestedClips/getSuggestedClips.handler.js";
import { GetTrendingHandler } from "./queries/getTrending/getTrending.handler.js";
import type { FeedSignalsService } from "./services/feedSignals.service.js";
import type { FeedsService } from "./services/feeds.service.js";
import type { TrendingService } from "./services/trending.service.js";

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

export interface FeedsModuleServices {
  readonly feeds: FeedsService;
  readonly signals: FeedSignalsService;
  readonly trending: TrendingService;
}

export function registerFeedsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, services: FeedsModuleServices): void {
  registerCommandHandlers(commands, [
    new RecordFeedInteractionHandler(services.signals),
    new RecordProductInteractionHandler(services.signals),
    new RecordFeedFeedbackHandler(services.signals),
  ]);
  registerQueryHandlers(queries, [
    new GetForYouFeedHandler(services.feeds),
    new GetFollowingFeedHandler(services.feeds),
    new GetSuggestedClipsHandler(services.feeds),
    new GetTrendingHandler(services.trending),
  ]);
}
