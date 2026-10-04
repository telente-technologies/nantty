import type { SocialDatabase } from "../databases/prisma.database.js";
import type { AuthorRankingDirectory } from "../interfaces/authorRanking.interface.js";
import type { IntelligenceExploreClient } from "../interfaces/intelligenceExplore.interface.js";
import type { RankingSettingsSource } from "../interfaces/rankingSettings.interface.js";
import type { Clock } from "../interfaces/clock.interface.js";
import type { FeedRanker } from "../interfaces/feedRanker.interface.js";
import type { LinkUnfurler } from "../interfaces/linkUnfurler.interface.js";
import type { IdentityDirectory } from "../interfaces/identityDirectory.interface.js";
import type { MediaDescriptorResolver } from "../interfaces/mediaDescriptorResolver.interface.js";
import type { ShareCardResolver } from "../interfaces/shareCardResolver.interface.js";
import type { SpamScoreProvider } from "../interfaces/spamScoreProvider.interface.js";
import type { PremiumEntitlements } from "../interfaces/premiumEntitlements.interface.js";

export interface HandlerContext {
  readonly database: SocialDatabase;
  readonly directory: IdentityDirectory;
  readonly clock: Clock;
  readonly premium: PremiumEntitlements;
  readonly ranker: FeedRanker;
  readonly spamScores?: SpamScoreProvider;
  readonly shareCards?: ShareCardResolver;
  readonly media?: MediaDescriptorResolver;
  readonly linkPreviews?: LinkUnfurler;
  readonly authorRanking?: AuthorRankingDirectory;
  readonly rankingSettings?: RankingSettingsSource;
  readonly intelligenceExplore?: IntelligenceExploreClient;
}

export type Handler<TInput, TResult> = (input: TInput) => Promise<TResult>;
