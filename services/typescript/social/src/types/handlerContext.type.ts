import type { SocialDatabase } from "../databases/prisma.database.js";
import type { Clock } from "../interfaces/clock.interface.js";
import type { FeedRanker } from "../interfaces/feedRanker.interface.js";
import type { IdentityDirectory } from "../interfaces/identityDirectory.interface.js";
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
}

export type Handler<TInput, TResult> = (input: TInput) => Promise<TResult>;
