import { randomUUID } from "node:crypto";

import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type { NewReferral, ReferralRecord, ReferralStatus } from "../models/loyalty.model.js";

export interface ReferralRewardChange {
  readonly rewardAmount: MinorUnits;
  readonly rewardCurrency: CurrencyCode;
  readonly updatedAt: Date;
}

export interface ReferralsRepository {
  findCodeForUser(userId: string): Promise<string | undefined>;
  findUserIdForCode(code: string): Promise<string | undefined>;
  saveCodeIfFree(userId: string, code: string): Promise<boolean>;
  createReferral(input: NewReferral): Promise<ReferralRecord | undefined>;
  findReferralForReferee(refereeId: string): Promise<ReferralRecord | undefined>;
  listReferralsForReferrer(referrerId: string): Promise<readonly ReferralRecord[]>;
  countReferralsSince(referrerId: string, since: Date): Promise<number>;
  markRewarded(referralId: string, from: ReferralStatus, change: ReferralRewardChange): Promise<boolean>;
}

export class InMemoryReferralsRepository implements ReferralsRepository {
  private readonly codesByUser = new Map<string, string>();
  private readonly referrals = new Map<string, ReferralRecord>();

  public async findCodeForUser(userId: string): Promise<string | undefined> {
    return this.codesByUser.get(userId);
  }

  public async findUserIdForCode(code: string): Promise<string | undefined> {
    return [...this.codesByUser.entries()].find(([, candidate]) => candidate === code)?.[0];
  }

  public async saveCodeIfFree(userId: string, code: string): Promise<boolean> {
    if (this.codesByUser.has(userId) || [...this.codesByUser.values()].includes(code)) return false;
    this.codesByUser.set(userId, code);
    return true;
  }

  public async createReferral(input: NewReferral): Promise<ReferralRecord | undefined> {
    if ([...this.referrals.values()].some((referral) => referral.refereeId === input.refereeId)) return undefined;
    const referral: ReferralRecord = { ...input, id: randomUUID(), rewardAmount: null, rewardCurrency: null, updatedAt: input.createdAt };
    this.referrals.set(referral.id, referral);
    return referral;
  }

  public async findReferralForReferee(refereeId: string): Promise<ReferralRecord | undefined> {
    return [...this.referrals.values()].find((referral) => referral.refereeId === refereeId);
  }

  public async listReferralsForReferrer(referrerId: string): Promise<readonly ReferralRecord[]> {
    return [...this.referrals.values()].filter((referral) => referral.referrerId === referrerId).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  public async countReferralsSince(referrerId: string, since: Date): Promise<number> {
    return [...this.referrals.values()].filter((referral) => referral.referrerId === referrerId && referral.createdAt >= since).length;
  }

  public async markRewarded(referralId: string, from: ReferralStatus, change: ReferralRewardChange): Promise<boolean> {
    const referral = this.referrals.get(referralId);
    if (referral?.status !== from) return false;
    this.referrals.set(referralId, { ...referral, ...change, status: "rewarded" });
    return true;
  }
}
