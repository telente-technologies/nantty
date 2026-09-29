import { notFound, unprocessable } from "../../../errors/domain.error.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { Money } from "../../../utils/money.util.js";
import { mapPageItems } from "../../../utils/pagination.util.js";
import type { BrandDealDto } from "../dtos/creators.dto.js";
import type { BrandDealRecord } from "../models/creators.model.js";
import type { BrandDealsRepository } from "../repositories/brandDeals.repository.js";
import type { CreatorsService } from "./creators.service.js";

export interface NewBrandDealInput {
  readonly brandName: string;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly startsAt: string;
  readonly endsAt?: string | undefined;
  readonly disclosure: string;
  readonly notes?: string | undefined;
}

export function presentBrandDeal(deal: BrandDealRecord): BrandDealDto {
  return {
    id: deal.id,
    brandName: deal.brandName,
    amount: Money.of(deal.amount, deal.currency).toDto(),
    startsAt: deal.startsAt.toISOString(),
    endsAt: deal.endsAt?.toISOString() ?? null,
    disclosure: deal.disclosure,
    notes: deal.notes,
    createdAt: deal.createdAt.toISOString(),
  };
}

export class BrandDealsService {
  public constructor(private readonly creatorsService: CreatorsService, private readonly deals: BrandDealsRepository) {}

  public async recordBrandDeal(creatorId: string, input: NewBrandDealInput): Promise<BrandDealDto> {
    await this.creatorsService.findApprovedProfileOrThrow(creatorId);
    const startsAt = new Date(input.startsAt);
    const endsAt = input.endsAt === undefined ? null : new Date(input.endsAt);
    if (endsAt !== null && endsAt < startsAt) throw unprocessable("A brand deal cannot end before it starts.");
    const deal = await this.deals.create({
      creatorId, brandName: input.brandName, amount: input.amount, currency: input.currency, startsAt, endsAt, disclosure: input.disclosure, notes: input.notes ?? null,
      createdAt: this.creatorsService.dependencies.clock.now(),
    });
    await this.creatorsService.dependencies.audit.record({ actorId: creatorId, action: "creators.brand_deal_recorded", entityType: "brand_deal", entityId: deal.id, metadata: { brandName: deal.brandName } });
    return presentBrandDeal(deal);
  }

  public async listBrandDeals(creatorId: string, page: PageRequest): Promise<Page<BrandDealDto>> {
    return mapPageItems(await this.deals.listForCreator(creatorId, page), presentBrandDeal);
  }

  public async removeBrandDeal(creatorId: string, dealId: string): Promise<void> {
    if (!(await this.deals.delete(creatorId, dealId))) throw notFound("Brand deal");
  }
}
