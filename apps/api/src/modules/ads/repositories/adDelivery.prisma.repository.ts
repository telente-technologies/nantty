import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type {
  AdBillingTransactionRecord,
  AdEventFilter,
  AdEventRecord,
  AdEventType,
  AdServingRecord,
  BillingTransactionType,
  NewAdBillingTransactionInput,
  NewAdEventInput,
  NewAdServingInput,
} from "../models/adDelivery.model.js";
import type { AdDeliveryRepository, ServingLookup } from "./adDelivery.repository.js";

type ServingRow = Awaited<ReturnType<ReturnType<typeof prisma>["adServing"]["create"]>>;
type EventRow = Awaited<ReturnType<ReturnType<typeof prisma>["adEvent"]["create"]>>;
type TransactionRow = Awaited<ReturnType<ReturnType<typeof prisma>["adBillingTransaction"]["create"]>>;

function toServing(row: ServingRow): AdServingRecord {
  return {
    ...row,
    surface: row.surface as AdServingRecord["surface"],
    placement: row.placement as AdServingRecord["placement"],
    chargeModel: row.chargeModel as AdServingRecord["chargeModel"],
    chargePriceMinor: Number(row.chargePriceMinor),
    currency: row.currency as CurrencyCode,
  };
}

function toEvent(row: EventRow): AdEventRecord {
  return {
    ...row,
    type: row.type as AdEventType,
    chargeMilliMinor: Number(row.chargeMilliMinor),
    currency: row.currency as CurrencyCode,
    valueMinor: row.valueMinor === null ? null : Number(row.valueMinor),
  };
}

function toTransaction(row: TransactionRow): AdBillingTransactionRecord {
  return { ...row, type: row.type as BillingTransactionType, amountMinor: Number(row.amountMinor), currency: row.currency as CurrencyCode };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export class PrismaAdDeliveryRepository implements AdDeliveryRepository {
  public async createServings(servings: readonly NewAdServingInput[]): Promise<readonly AdServingRecord[]> {
    const rows = await prisma().$transaction(servings.map((serving) => prisma().adServing.create({ data: { ...serving, chargePriceMinor: BigInt(serving.chargePriceMinor) } })));
    return rows.map(toServing);
  }

  public async findLatestServing(lookup: ServingLookup): Promise<AdServingRecord | undefined> {
    const row = await prisma().adServing.findFirst({
      where: { viewerId: lookup.viewerId, campaignId: lookup.campaignId, itemId: lookup.itemId, servedAt: { gte: lookup.servedAfter } },
      orderBy: { servedAt: "desc" },
    });
    return row === null ? undefined : toServing(row);
  }

  public async recordEvent(event: NewAdEventInput): Promise<AdEventRecord | undefined> {
    try {
      const row = await prisma().adEvent.create({
        data: { ...event, chargeMilliMinor: BigInt(event.chargeMilliMinor), valueMinor: event.valueMinor === null ? null : BigInt(event.valueMinor) },
      });
      return toEvent(row);
    } catch (error) {
      if (isUniqueViolation(error)) return undefined;
      throw error;
    }
  }

  public async updateEventBilling(eventId: string, billed: boolean, chargeMilliMinor: number, rejectionReason: string | null): Promise<void> {
    await prisma().adEvent.update({ where: { id: eventId }, data: { billed, chargeMilliMinor: BigInt(chargeMilliMinor), rejectionReason } });
  }

  public async countViewerEvents(viewerId: string, type: AdEventType, since: Date): Promise<number> {
    return prisma().adEvent.count({ where: { viewerId, type, occurredAt: { gte: since } } });
  }

  public async countViewerImpressionsByCampaign(viewerId: string, since: Date): Promise<ReadonlyMap<string, number>> {
    const groups = await prisma().adEvent.groupBy({ by: ["campaignId"], where: { viewerId, type: "impression", occurredAt: { gte: since } }, _count: { _all: true } });
    return new Map(groups.map((group) => [group.campaignId, group._count._all]));
  }

  public async listViewerClicks(viewerId: string, since: Date): Promise<readonly AdEventRecord[]> {
    const rows = await prisma().adEvent.findMany({ where: { viewerId, type: "click", rejectionReason: null, occurredAt: { gte: since } }, orderBy: { occurredAt: "desc" }, take: 200 });
    return rows.map(toEvent);
  }

  public async listEvents(filter: AdEventFilter): Promise<readonly AdEventRecord[]> {
    const rows = await prisma().adEvent.findMany({
      where: {
        accountId: filter.accountId,
        ...(filter.campaignIds === undefined ? {} : { campaignId: { in: [...filter.campaignIds] } }),
        ...(filter.adSetId === undefined ? {} : { adSetId: filter.adSetId }),
        ...(filter.adId === undefined ? {} : { adId: filter.adId }),
        ...(filter.from === undefined && filter.to === undefined ? {} : { occurredAt: { ...(filter.from === undefined ? {} : { gte: filter.from }), ...(filter.to === undefined ? {} : { lt: filter.to }) } }),
      },
    });
    return rows.map(toEvent);
  }

  public async recordBillingTransaction(transaction: NewAdBillingTransactionInput): Promise<AdBillingTransactionRecord | undefined> {
    try {
      return toTransaction(await prisma().adBillingTransaction.create({ data: { ...transaction, amountMinor: BigInt(transaction.amountMinor) } }));
    } catch (error) {
      if (isUniqueViolation(error)) return undefined;
      throw error;
    }
  }

  public async listBillingTransactions(accountId: string): Promise<readonly AdBillingTransactionRecord[]> {
    return (await prisma().adBillingTransaction.findMany({ where: { accountId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1_000 })).map(toTransaction);
  }
}
