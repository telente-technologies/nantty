import { forbidden } from "../../../errors/domain.error.js";
import type { CreatorDashboardDto } from "../dtos/creators.dto.js";
import type { CreatorEarningKind } from "../models/creators.model.js";
import type { EarningTotal } from "../repositories/creatorEarnings.repository.js";
import type { CreatorsService } from "./creators.service.js";

export type DashboardPeriod = "today" | "week" | "month" | "all";

function selectEarningsOfKind(totals: readonly EarningTotal[], kind: CreatorEarningKind) {
  return totals.filter((total) => total.kind === kind).map((total) => ({ amountMinor: total.netAmount, currency: total.currency }));
}

export class CreatorDashboardService {
  public constructor(private readonly creatorsService: CreatorsService) {}

  public async buildDashboard(creatorId: string, period: DashboardPeriod): Promise<CreatorDashboardDto> {
    const { program, socialGraph, postsService, earnings, creatorWallets } = this.creatorsService.dependencies;
    if ((await program.findProfile(creatorId)) === undefined) throw forbidden("The creator dashboard is available to approved creators.");
    const since = this.creatorsService.calculateSinceForPeriod(period);
    const [followers, gainedInPeriod, content, live, totals, wallet, coins] = await Promise.all([
      socialGraph.countFollowers("user", creatorId),
      since === null ? Promise.resolve(null) : socialGraph.countFollowersSince("user", creatorId, since),
      postsService.dependencies.posts.summarizeAuthorContent(creatorId),
      postsService.dependencies.liveSessions.summarizeHostedSessions(creatorId, since),
      earnings.sumEarningsSince(creatorId, since),
      creatorWallets.findUserWalletSummary(creatorId),
      creatorWallets.findCreatorCoinBalances(creatorId),
    ]);
    return {
      period,
      since: since?.toISOString() ?? null,
      followers: { total: followers, gainedInPeriod },
      content: { posts: content.postCount, views: content.viewCount },
      earnings: {
        gifts: selectEarningsOfKind(totals, "gift"),
        tips: selectEarningsOfKind(totals, "tip"),
        affiliate: selectEarningsOfKind(totals, "affiliate"),
        subscriptions: selectEarningsOfKind(totals, "subscription"),
      },
      coins: { spendable: coins.spendableCoins, earned: coins.earnedCoins },
      live: {
        sessionsHosted: live.sessions,
        reactions: live.reactions,
        giftsReceived: totals.filter((total) => total.kind === "gift").reduce((count, total) => count + total.count, 0),
      },
      walletBalances: wallet.balances.map((balance) => balance.toDto()),
    };
  }
}
