import { randomBytes } from "node:crypto";

import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { invalidState, notFound, unprocessable } from "../../../errors/domain.error.js";
import type { ReferralFraudScreen, ReferralFraudVerdict } from "../../../interfaces/referralFraudScreen.interface.js";
import type { SocialGraph } from "../../../interfaces/socialGraph.interface.js";
import type { UserAccountStandingLookup, UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import { MonetizationLedgerAccounts } from "../../wallets/constants/monetizationLedgerAccounts.constant.js";
import { LedgerAccounts } from "../../wallets/services/ledger.service.js";
import type { ReferralRecord, RewardableOrder } from "../models/loyalty.model.js";
import type { ReferralsRepository } from "../repositories/referrals.repository.js";
import type { LoyaltyDependencies } from "./loyaltyPoints.service.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_REFERRALS_PER_DAY = 20;

export interface ReferralPorts {
  readonly referrals: ReferralsRepository;
  readonly userDirectory: UserDirectory & Partial<UserAccountStandingLookup>;
  readonly socialGraph: SocialGraph;
  readonly fraudScreen: ReferralFraudScreen | undefined;
}

export class HeuristicReferralFraudScreen implements ReferralFraudScreen {
  public async screenReferral(check: Parameters<ReferralFraudScreen["screenReferral"]>[0]): Promise<ReferralFraudVerdict> {
    if (check.referrerId === check.refereeId) return { allowed: false, reason: "self_referral" };
    if (check.referrerReferralsInLastDay >= MAX_REFERRALS_PER_DAY) return { allowed: false, reason: "referral_velocity" };
    return { allowed: true, reason: null };
  }
}

function generateReferralCode(): string {
  return [...randomBytes(8)].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

export class ReferralsService {
  private readonly heuristics = new HeuristicReferralFraudScreen();

  public constructor(public readonly dependencies: LoyaltyDependencies, public readonly ports: ReferralPorts) {}

  public async findOrCreateCode(userId: string): Promise<string> {
    const { referrals } = this.ports;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await referrals.findCodeForUser(userId);
      if (existing !== undefined) return existing;
      await referrals.saveCodeIfFree(userId, generateReferralCode());
    }
    const code = await referrals.findCodeForUser(userId);
    if (code === undefined) throw invalidState("Could not create a referral code; try again.");
    return code;
  }

  public listReferrals(referrerId: string): Promise<readonly ReferralRecord[]> {
    return this.ports.referrals.listReferralsForReferrer(referrerId);
  }

  public async redeemCode(refereeId: string, rawCode: string): Promise<ReferralRecord> {
    const { referrals, socialGraph, userDirectory, fraudScreen } = this.ports;
    const { commerce, clock, audit } = this.dependencies;
    const code = rawCode.trim().toUpperCase();
    const referrerId = await referrals.findUserIdForCode(code);
    if (referrerId === undefined) throw notFound("Referral code");
    if (referrerId === refereeId) throw unprocessable("You cannot use your own referral code.");
    if ((await referrals.findReferralForReferee(refereeId)) !== undefined) throw invalidState("You have already used a referral code.");
    if ((await commerce.countCompletedOrdersForBuyer(refereeId)) > 0) throw unprocessable("Referral codes are for new customers before their first order.");
    if (await socialGraph.isBlockedEitherWay(refereeId, referrerId)) throw unprocessable("This referral code cannot be used.");
    const now = clock.now();
    const check = {
      referrerId,
      refereeId,
      refereeAccountCreatedAt: (await userDirectory.findUserAccountStanding?.(refereeId))?.createdAt ?? null,
      referrerReferralsInLastDay: await referrals.countReferralsSince(referrerId, new Date(now.getTime() - 86_400_000)),
    };
    const heuristic = await this.heuristics.screenReferral(check);
    const verdict = heuristic.allowed && fraudScreen !== undefined ? await fraudScreen.screenReferral(check) : heuristic;
    const referral = await referrals.createReferral({ referrerId, refereeId, code, status: verdict.allowed ? "joined" : "rejected", rejectionReason: verdict.reason, createdAt: now });
    if (referral === undefined) throw invalidState("You have already used a referral code.");
    await audit.record({ actorId: refereeId, action: verdict.allowed ? "loyalty.referral_joined" : "loyalty.referral_rejected", entityType: "referral", entityId: referral.id, metadata: { referrerId, reason: verdict.reason } });
    if (!verdict.allowed) throw unprocessable("This referral could not be accepted.");
    return referral;
  }

  public async rewardReferralAfterFirstOrder(order: RewardableOrder): Promise<boolean> {
    const { referrals } = this.ports;
    const { commerce, ledger, rewards, settings, clock } = this.dependencies;
    const referral = await referrals.findReferralForReferee(order.buyerId);
    if (referral?.status !== "joined") return false;
    if ((await commerce.countCompletedOrdersForBuyer(order.buyerId)) !== 1) return false;
    const reward = settings.loyalty.referralRewardMinor[order.currency];
    if (!(await referrals.markRewarded(referral.id, "joined", { rewardAmount: reward, rewardCurrency: order.currency, updatedAt: clock.now() }))) return false;
    for (const [role, userId] of [["referrer", referral.referrerId], ["referee", referral.refereeId]] as const) {
      const reference = `referral-reward:${referral.id}:${role}`;
      await ledger.postLedgerTransaction({
        reference,
        kind: "referral_reward",
        description: `Referral reward (${role})`,
        lines: [
          { account: MonetizationLedgerAccounts.referralRewardExpense(order.currency), direction: "debit", amount: reward, currency: order.currency },
          { account: LedgerAccounts.userWallet(userId, order.currency), direction: "credit", amount: reward, currency: order.currency },
        ],
      });
      await rewards.recordRewardIfNew({ userId, kind: "referral_reward", reference, points: 0, amount: reward, currency: order.currency as CurrencyCode, orderId: order.id, description: `Referral reward as ${role}`, createdAt: clock.now() });
    }
    return true;
  }
}
