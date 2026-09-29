import { randomUUID } from "node:crypto";

import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { BrandDeal } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, compareByNewestFirst, mapPageItems, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { BrandDealRecord, NewBrandDeal } from "../models/creators.model.js";

export interface BrandDealsRepository {
  create(input: NewBrandDeal): Promise<BrandDealRecord>;
  listForCreator(creatorId: string, page: PageRequest): Promise<Page<BrandDealRecord>>;
  delete(creatorId: string, dealId: string): Promise<boolean>;
}

export class InMemoryBrandDealsRepository implements BrandDealsRepository {
  private readonly deals = new Map<string, BrandDealRecord>();

  public async create(input: NewBrandDeal): Promise<BrandDealRecord> {
    const deal = { ...input, id: randomUUID() };
    this.deals.set(deal.id, deal);
    return deal;
  }

  public async listForCreator(creatorId: string, page: PageRequest): Promise<Page<BrandDealRecord>> {
    return paginateSortedItems([...this.deals.values()].filter((deal) => deal.creatorId === creatorId).sort(compareByNewestFirst), page);
  }

  public async delete(creatorId: string, dealId: string): Promise<boolean> {
    if (this.deals.get(dealId)?.creatorId !== creatorId) return false;
    return this.deals.delete(dealId);
  }
}

function convertBrandDealRow(row: BrandDeal): BrandDealRecord {
  return { ...row, amount: convertDatabaseAmountToMinorUnits(row.amount), currency: row.currency as CurrencyCode };
}

export class PrismaBrandDealsRepository implements BrandDealsRepository {
  public async create(input: NewBrandDeal): Promise<BrandDealRecord> {
    return convertBrandDealRow(await prisma().brandDeal.create({ data: { ...input, amount: BigInt(input.amount) } }));
  }

  public async listForCreator(creatorId: string, page: PageRequest): Promise<Page<BrandDealRecord>> {
    const rows = await prisma().brandDeal.findMany({ where: { creatorId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...buildPrismaPageArguments(page) });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertBrandDealRow);
  }

  public async delete(creatorId: string, dealId: string): Promise<boolean> {
    return (await prisma().brandDeal.deleteMany({ where: { id: dealId, creatorId } })).count > 0;
  }
}
