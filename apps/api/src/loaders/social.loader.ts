import type { CurrencyConverter } from "../interfaces/currencyConverter.interface.js";
import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { OrderLookup } from "../interfaces/orderLookup.interface.js";
import type { ProductCatalog } from "../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../interfaces/storeAccess.interface.js";
import type { UserDirectory } from "../interfaces/userDirectory.interface.js";
import { FeedsController } from "../modules/feeds/controllers/feeds.controller.js";
import { registerFeedsCommandAndQueryHandlers } from "../modules/feeds/feeds.module.js";
import { InMemoryFeedInteractionsRepository, PrismaFeedInteractionsRepository } from "../modules/feeds/repositories/feeds.repository.js";
import { FeedsService } from "../modules/feeds/services/feeds.service.js";
import { FollowsController } from "../modules/follows/controllers/follows.controller.js";
import { registerFollowsCommandAndQueryHandlers } from "../modules/follows/follows.module.js";
import { InMemoryBlocksRepository, PrismaBlocksRepository } from "../modules/follows/repositories/blocks.repository.js";
import { PrismaFollowsRepository } from "../modules/follows/repositories/follows.prisma.repository.js";
import { InMemoryFollowsRepository } from "../modules/follows/repositories/follows.repository.js";
import { FollowsService } from "../modules/follows/services/follows.service.js";
import { RepositorySocialGraph } from "../modules/follows/services/socialGraph.service.js";
import { LiveController } from "../modules/posts/controllers/live.controller.js";
import { PostsController } from "../modules/posts/controllers/posts.controller.js";
import { registerPostsCommandAndQueryHandlers } from "../modules/posts/posts.module.js";
import { PrismaLiveSessionsRepository } from "../modules/posts/repositories/live.prisma.repository.js";
import { InMemoryLiveSessionsRepository } from "../modules/posts/repositories/live.repository.js";
import { PrismaPostInteractionsRepository } from "../modules/posts/repositories/postInteractions.prisma.repository.js";
import { InMemoryPostInteractionsRepository } from "../modules/posts/repositories/postInteractions.repository.js";
import { PrismaPostsRepository } from "../modules/posts/repositories/posts.prisma.repository.js";
import { InMemoryPostsRepository } from "../modules/posts/repositories/posts.repository.js";
import { PrismaSocialEngagementRepository } from "../modules/posts/repositories/socialEngagement.prisma.repository.js";
import { InMemorySocialEngagementRepository } from "../modules/posts/repositories/socialEngagement.repository.js";
import { StoriesController } from "../modules/posts/controllers/stories.controller.js";
import { PostsService } from "../modules/posts/services/posts.service.js";
import { ReviewsController } from "../modules/reviews/controllers/reviews.controller.js";
import { PrismaReviewsRepository } from "../modules/reviews/repositories/reviews.prisma.repository.js";
import { InMemoryReviewsRepository } from "../modules/reviews/repositories/reviews.repository.js";
import { registerReviewsCommandAndQueryHandlers } from "../modules/reviews/reviews.module.js";
import { ReviewsService } from "../modules/reviews/services/reviews.service.js";
import type { Core } from "./core.loader.js";

export interface SocialSharedServices {
  readonly currencyConverter: CurrencyConverter;
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory;
  readonly storeAccess: StoreAccess;
  readonly productCatalog: ProductCatalog;
  readonly orderLookup: OrderLookup;
}

export function createSocialModules(core: Core, shared: SocialSharedServices) {
  const usePrisma = core.persistence === "prisma";
  const { commands, queries, events, clock } = core;
  const follows = usePrisma ? new PrismaFollowsRepository() : new InMemoryFollowsRepository();
  const blocks = usePrisma ? new PrismaBlocksRepository() : new InMemoryBlocksRepository();
  const socialGraph = new RepositorySocialGraph(follows, blocks);
  const followsService = new FollowsService({ follows, blocks, userDirectory: shared.userDirectory, storeAccess: shared.storeAccess, orderLookup: shared.orderLookup, events, clock });
  registerFollowsCommandAndQueryHandlers(commands, queries, followsService);

  const postsService = new PostsService({
    posts: usePrisma ? new PrismaPostsRepository() : new InMemoryPostsRepository(),
    interactions: usePrisma ? new PrismaPostInteractionsRepository() : new InMemoryPostInteractionsRepository(),
    engagement: usePrisma ? new PrismaSocialEngagementRepository() : new InMemorySocialEngagementRepository(),
    liveSessions: usePrisma ? new PrismaLiveSessionsRepository() : new InMemoryLiveSessionsRepository(),
    userDirectory: shared.userDirectory,
    productCatalog: shared.productCatalog,
    storeAccess: shared.storeAccess,
    socialGraph,
    events,
    clock,
    currencyConverter: shared.currencyConverter,
  });
  registerPostsCommandAndQueryHandlers(commands, queries, postsService);

  const feedsService = new FeedsService({
    postsService,
    feedInteractions: usePrisma ? new PrismaFeedInteractionsRepository() : new InMemoryFeedInteractionsRepository(),
    socialGraph,
    userDirectory: shared.userDirectory,
    clock,
  });
  registerFeedsCommandAndQueryHandlers(commands, queries, feedsService);

  const reviewsService = new ReviewsService({
    reviews: usePrisma ? new PrismaReviewsRepository() : new InMemoryReviewsRepository(),
    orderLookup: shared.orderLookup,
    productCatalog: shared.productCatalog,
    storeAccess: shared.storeAccess,
    userDirectory: shared.userDirectory,
    events,
    clock,
  });
  registerReviewsCommandAndQueryHandlers(commands, queries, reviewsService);

  return {
    socialGraph,
    controllers: {
      followsController: new FollowsController(commands, queries),
      postsController: new PostsController(commands, queries),
      liveController: new LiveController(commands, queries),
      storiesController: new StoriesController(commands, queries),
      feedsController: new FeedsController(commands, queries),
      reviewsController: new ReviewsController(commands, queries),
    },
  };
}
