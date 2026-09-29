import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { LoyaltyRewardKind, LoyaltyRewardRecord, NewLoyaltyReward, PointsRedemptionRecord, PointsRedemptionStatus } from "../models/loyalty.model.js";

export interface LoyaltyRewardsRepository {
  recordRewardIfNew(reward: NewLoyaltyReward): Promise<{ readonly reward: LoyaltyRewardRecord; readonly created: boolean }>;
  listRewards(userId: string, page: PageRequest): Promise<Page<LoyaltyRewardRecord>>;
  listRewardsOfKind(userId: string, kind: LoyaltyRewardKind): Promise<readonly LoyaltyRewardRecord[]>;
  sumPointsEarned(userId: string): Promise<number>;
  createRedemption(redemption: PointsRedemptionRecord): Promise<boolean>;
  findRedemption(checkoutId: string): Promise<PointsRedemptionRecord | undefined>;
  changeRedemptionStatus(checkoutId: string, from: PointsRedemptionStatus, to: PointsRedemptionStatus): Promise<boolean>;
}

export class InMemoryLoyaltyRewardsRepository implements LoyaltyRewardsRepository {
  private readonly rewards = new Map<string, LoyaltyRewardRecord>();
  private readonly redemptions = new Map<string, PointsRedemptionRecord>();

  public async recordRewardIfNew(reward: NewLoyaltyReward): Promise<{ readonly reward: LoyaltyRewardRecord; readonly created: boolean }> {
    const existing = this.rewards.get(reward.reference);
    if (existing !== undefined) return { reward: existing, created: false };
    const created = { ...reward, id: randomUUID() };
    this.rewards.set(reward.reference, created);
    return { reward: created, created: true };
  }

  public async listRewards(userId: string, page: PageRequest): Promise<Page<LoyaltyRewardRecord>> {
    return paginateSortedItems([...this.rewards.values()].filter((reward) => reward.userId === userId).sort(compareByNewestFirst), page);
  }

  public async listRewardsOfKind(userId: string, kind: LoyaltyRewardKind): Promise<readonly LoyaltyRewardRecord[]> {
    return [...this.rewards.values()].filter((reward) => reward.userId === userId && reward.kind === kind);
  }

  public async sumPointsEarned(userId: string): Promise<number> {
    return [...this.rewards.values()].filter((reward) => reward.userId === userId && reward.kind === "points_earned").reduce((total, reward) => total + reward.points, 0);
  }

  public async createRedemption(redemption: PointsRedemptionRecord): Promise<boolean> {
    if (this.redemptions.has(redemption.checkoutId)) return false;
    this.redemptions.set(redemption.checkoutId, redemption);
    return true;
  }

  public async findRedemption(checkoutId: string): Promise<PointsRedemptionRecord | undefined> {
    return this.redemptions.get(checkoutId);
  }

  public async changeRedemptionStatus(checkoutId: string, from: PointsRedemptionStatus, to: PointsRedemptionStatus): Promise<boolean> {
    const redemption = this.redemptions.get(checkoutId);
    if (redemption?.status !== from) return false;
    this.redemptions.set(checkoutId, { ...redemption, status: to });
    return true;
  }
}
