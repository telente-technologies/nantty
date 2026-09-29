import { notFound } from "../../../errors/domain.error.js";
import { MonetizationLedgerAccounts } from "../../wallets/constants/monetizationLedgerAccounts.constant.js";
import { LedgerAccounts } from "../../wallets/services/ledger.service.js";
import type { CashbackPromoRecord, RewardableOrder } from "../models/loyalty.model.js";
import type { CashbackPromosRepository } from "../repositories/cashbackPromos.repository.js";
import type { LoyaltyDependencies } from "./loyaltyPoints.service.js";

export interface NewCashbackPromoInput {
  readonly storeId?: string | undefined;
  readonly categoryId?: string | undefined;
  readonly rateBps: number;
  readonly startsAt?: string | undefined;
  readonly endsAt?: string | undefined;
}

export function calculateOrderCashback(order: RewardableOrder, promos: readonly CashbackPromoRecord[], defaultBps: number): number {
  return order.items.reduce((total, item) => {
    const rates = promos.filter((promo) => promo.storeId === order.storeId || (promo.categoryId !== null && promo.categoryId === item.categoryId)).map((promo) => promo.rateBps);
    const rate = Math.max(defaultBps, ...rates);
    return total + Number((BigInt(item.lineTotal) * BigInt(rate)) / 10_000n);
  }, 0);
}

export class CashbackService {
  public constructor(private readonly dependencies: LoyaltyDependencies, private readonly promos: CashbackPromosRepository) {}

  public async createPromo(adminId: string, input: NewCashbackPromoInput): Promise<CashbackPromoRecord> {
    const { clock, audit } = this.dependencies;
    const promo = await this.promos.create({
      storeId: input.storeId ?? null,
      categoryId: input.categoryId ?? null,
      rateBps: input.rateBps,
      startsAt: input.startsAt === undefined ? clock.now() : new Date(input.startsAt),
      endsAt: input.endsAt === undefined ? null : new Date(input.endsAt),
      active: true,
      createdById: adminId,
      createdAt: clock.now(),
    });
    await audit.record({ actorId: adminId, action: "loyalty.cashback_promo_created", entityType: "cashback_promo", entityId: promo.id, metadata: { after: promo } });
    return promo;
  }

  public listPromos(): Promise<readonly CashbackPromoRecord[]> {
    return this.promos.listAll();
  }

  public async deactivatePromo(adminId: string, promoId: string): Promise<void> {
    if (!(await this.promos.deactivate(promoId))) throw notFound("Cashback promo");
    await this.dependencies.audit.record({ actorId: adminId, action: "loyalty.cashback_promo_deactivated", entityType: "cashback_promo", entityId: promoId });
  }

  public async creditCashbackForOrder(order: RewardableOrder): Promise<number> {
    const { ledger, rewards, settings, clock } = this.dependencies;
    const categoryIds = [...new Set(order.items.map((item) => item.categoryId).filter((id): id is string => id !== null))];
    const promos = await this.promos.listActiveAt(clock.now(), order.storeId, categoryIds);
    const cashback = calculateOrderCashback(order, promos, settings.loyalty.defaultCashbackBps);
    if (cashback <= 0) return 0;
    const reference = `cashback:${order.id}`;
    await ledger.postLedgerTransaction({
      reference,
      kind: "cashback",
      description: "Cashback on a completed order",
      lines: [
        { account: MonetizationLedgerAccounts.cashbackExpense(order.currency), direction: "debit", amount: cashback, currency: order.currency },
        { account: LedgerAccounts.userWallet(order.buyerId, order.currency), direction: "credit", amount: cashback, currency: order.currency },
      ],
    });
    await rewards.recordRewardIfNew({
      userId: order.buyerId, kind: "cashback", reference, points: 0, amount: cashback, currency: order.currency, orderId: order.id, description: "Cashback on a completed order", createdAt: clock.now(),
    });
    return cashback;
  }
}
