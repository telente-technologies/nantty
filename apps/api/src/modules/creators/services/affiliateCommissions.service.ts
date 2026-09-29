import { NotificationRequestedEvent } from "../../../events/notificationRequested.event.js";
import type { AttributedOrderItem, SaleAttributionSource } from "../../../interfaces/orderLookup.interface.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import { Money } from "../../../utils/money.util.js";
import type { CreatorsService } from "./creators.service.js";

interface AttributedProductSale {
  readonly storeId: string;
  readonly productId: string;
  readonly source: SaleAttributionSource;
  readonly sourceId: string;
  readonly saleAmount: Money;
}

function combineAttributedSalesByProduct(items: readonly AttributedOrderItem[]): readonly AttributedProductSale[] {
  const sales = new Map<string, AttributedProductSale>();
  for (const item of items) {
    if (item.attributionSource === null || item.attributionId === null) continue;
    const lineAmount = Money.of(item.lineTotal, item.currency);
    const existing = sales.get(item.productId);
    if (existing !== undefined && existing.saleAmount.currency !== lineAmount.currency) continue;
    sales.set(item.productId, {
      storeId: item.storeId,
      productId: item.productId,
      source: existing?.source ?? item.attributionSource,
      sourceId: existing?.sourceId ?? item.attributionId,
      saleAmount: existing === undefined ? lineAmount : existing.saleAmount.add(lineAmount),
    });
  }
  return [...sales.values()];
}

export class AffiliateCommissionsService {
  public constructor(private readonly creatorsService: CreatorsService) {}

  public async creditCommissionsForReleasedOrder(orderId: string): Promise<number> {
    const items = await this.creatorsService.dependencies.orderLookup.listAttributedOrderItems(orderId);
    let credited = 0;
    for (const sale of combineAttributedSalesByProduct(items)) {
      if (await this.creditCommissionForSale(orderId, sale)) credited += 1;
    }
    return credited;
  }

  private async creditCommissionForSale(orderId: string, sale: AttributedProductSale): Promise<boolean> {
    const { affiliates, creatorWallets, earnings, events, clock } = this.creatorsService.dependencies;
    const creatorId = await this.findCreatorForAttribution(sale.source, sale.sourceId);
    if (creatorId === undefined || !(await this.creatorsService.access.isApprovedCreator(creatorId))) return false;
    if (await this.isSelfReferral(creatorId, orderId, sale)) return false;
    const commission = await affiliates.findApplicableCommission(sale.storeId, sale.productId);
    if (commission === undefined) return false;
    const amount = sale.saleAmount.calculateBasisPointsShareRoundingDown(commission.commissionBps);
    if (amount.amountMinor <= 0) return false;
    const reference = `affiliate-commission:${orderId}:${sale.productId}`;
    await creatorWallets.creditAffiliateCommission({ reference, storeId: sale.storeId, creatorUserId: creatorId, amount });
    const recorded = await earnings.recordEarningIfNew({
      creatorId,
      kind: "affiliate",
      reference,
      sourceType: sale.source,
      sourceId: sale.sourceId,
      grossAmount: amount.amountMinor,
      netAmount: amount.amountMinor,
      currency: amount.currency,
      orderId,
      productId: sale.productId,
      createdAt: clock.now(),
    });
    if (recorded) {
      await publishEvent(events, NotificationRequestedEvent, {
        userId: creatorId,
        category: "payments",
        title: "Affiliate commission earned",
        body: "A sale you referred was completed and your commission is in your wallet.",
        data: { type: "affiliate_commission", orderId, productId: sale.productId },
      });
    }
    return recorded;
  }

  private async findCreatorForAttribution(source: SaleAttributionSource, sourceId: string): Promise<string | undefined> {
    const { postsService } = this.creatorsService.dependencies;
    if (source === "live") return (await postsService.dependencies.liveSessions.findById(sourceId))?.hostId;
    const post = await postsService.dependencies.posts.findById(sourceId);
    return post === undefined || post.kind !== source ? undefined : post.authorId;
  }

  private async isSelfReferral(creatorId: string, orderId: string, sale: AttributedProductSale): Promise<boolean> {
    const { orderLookup, storeAccess } = this.creatorsService.dependencies;
    if ((await orderLookup.hasReceivedProductInOrder(creatorId, orderId, sale.productId)) !== undefined) return true;
    return (await storeAccess.listStoreIdsForMember(creatorId)).includes(sale.storeId);
  }
}
