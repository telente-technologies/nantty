import type { SocialDatabase } from "../databases/prisma.database.js";
import type { AuthorRankingDirectory } from "../interfaces/authorRanking.interface.js";
import type { IntelligenceExploreClient } from "../interfaces/intelligenceExplore.interface.js";
import type { RankingSettingsSource } from "../interfaces/rankingSettings.interface.js";
import type { AdDecisionClient } from "../interfaces/adDecisions.interface.js";
import type { ProductCatalog } from "../interfaces/productCatalog.interface.js";
import type { SocialProofSelector } from "../interfaces/socialProof.interface.js";
import type { ChatMediaAccess } from "../interfaces/chatMediaAccess.interface.js";
import type { StoreInboxTeam } from "../interfaces/storeInboxTeam.interface.js";
import type { Clock } from "../interfaces/clock.interface.js";
import type { FeedRanker } from "../interfaces/feedRanker.interface.js";
import type { LinkUnfurler } from "../interfaces/linkUnfurler.interface.js";
import type { IdentityDirectory } from "../interfaces/identityDirectory.interface.js";
import type { MediaDescriptorResolver } from "../interfaces/mediaDescriptorResolver.interface.js";
import type { MediaDownloadVariantClient } from "../interfaces/mediaDownloadVariant.interface.js";
import type { ShareCardResolver } from "../interfaces/shareCardResolver.interface.js";
import type { SpamScoreProvider } from "../interfaces/spamScoreProvider.interface.js";
import type { PlacesProvider } from "../interfaces/placesProvider.interface.js";
import type { PremiumEntitlements } from "../interfaces/premiumEntitlements.interface.js";
import type { PostMediaCleaner } from "../interfaces/postMediaCleaner.interface.js";

export interface HandlerContext {
  readonly database: SocialDatabase;
  readonly directory: IdentityDirectory;
  readonly clock: Clock;
  readonly premium: PremiumEntitlements;
  readonly ranker: FeedRanker;
  readonly clipRanker?: FeedRanker;
  readonly spamScores?: SpamScoreProvider;
  readonly shareCards?: ShareCardResolver;
  readonly media?: MediaDescriptorResolver;
  readonly chatMedia?: ChatMediaAccess;
  readonly storeInboxTeam?: StoreInboxTeam;
  readonly postMedia?: PostMediaCleaner;
  readonly products?: ProductCatalog;
  readonly ads?: AdDecisionClient;
  readonly socialProof?: SocialProofSelector;
  readonly mediaDownloads?: MediaDownloadVariantClient;
  readonly linkPreviews?: LinkUnfurler;
  readonly authorRanking?: AuthorRankingDirectory;
  readonly rankingSettings?: RankingSettingsSource;
  readonly intelligenceExplore?: IntelligenceExploreClient;
  readonly places?: PlacesProvider;
}

export type Handler<TInput, TResult> = (input: TInput) => Promise<TResult>;
