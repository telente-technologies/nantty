import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { CreatorSubscription, CreatorSubscriptionCharge } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import type {
  CreatorPlanInterval,
  CreatorSubscriptionChange,
  CreatorSubscriptionChargeKind,
  CreatorSubscriptionChargeRecord,
  CreatorSubscriptionChargeStatus,
  CreatorSubscriptionRecord,
  CreatorSubscriptionStatus,
  NewCreatorSubscription,
  NewCreatorSubscriptionCharge,
} from "../models/creatorSubscriptions.model.js";
import type { CreatorSubscriptionChargeChange, CreatorSubscriptionsRepository } from "./creatorSubscriptions.repository.js";

function convertSubscriptionRow(row: CreatorSubscription): CreatorSubscriptionRecord {
  return {
    ...row,
    amount: convertDatabaseAmountToMinorUnits(row.amount),
    currency: row.currency as CurrencyCode,
    status: row.status as CreatorSubscriptionStatus,
    interval: row.interval as CreatorPlanInterval,
  };
}

function convertChargeRow(row: CreatorSubscriptionCharge): CreatorSubscriptionChargeRecord {
  return {
    ...row,
    amount: convertDatabaseAmountToMinorUnits(row.amount),
    currency: row.currency as CurrencyCode,
    kind: row.kind as CreatorSubscriptionChargeKind,
    status: row.status as CreatorSubscriptionChargeStatus,
  };
}

export class PrismaCreatorSubscriptionsRepository implements CreatorSubscriptionsRepository {
  public async create(input: NewCreatorSubscription): Promise<CreatorSubscriptionRecord> {
    return convertSubscriptionRow(await prisma().creatorSubscription.create({ data: { ...input, amount: BigInt(input.amount) } }));
  }

  public async findById(subscriptionId: string): Promise<CreatorSubscriptionRecord | undefined> {
    const row = await prisma().creatorSubscription.findUnique({ where: { id: subscriptionId } });
    return row === null ? undefined : convertSubscriptionRow(row);
  }

  public async listForSubscriberAndCreators(subscriberId: string, creatorIds: readonly string[]): Promise<readonly CreatorSubscriptionRecord[]> {
    const rows = await prisma().creatorSubscription.findMany({ where: { subscriberId, creatorId: { in: [...creatorIds] } } });
    return rows.map(convertSubscriptionRow);
  }

  public async listForSubscriber(subscriberId: string): Promise<readonly CreatorSubscriptionRecord[]> {
    const rows = await prisma().creatorSubscription.findMany({ where: { subscriberId }, orderBy: { createdAt: "desc" } });
    return rows.map(convertSubscriptionRow);
  }

  public async listForCreator(creatorId: string, statuses: readonly CreatorSubscriptionStatus[]): Promise<readonly CreatorSubscriptionRecord[]> {
    const rows = await prisma().creatorSubscription.findMany({ where: { creatorId, status: { in: [...statuses] } }, orderBy: { createdAt: "desc" } });
    return rows.map(convertSubscriptionRow);
  }

  public async listWithPeriodEndingBefore(statuses: readonly CreatorSubscriptionStatus[], before: Date, limit: number): Promise<readonly CreatorSubscriptionRecord[]> {
    const rows = await prisma().creatorSubscription.findMany({
      where: { status: { in: [...statuses] }, currentPeriodEnd: { lte: before } },
      orderBy: { currentPeriodEnd: "asc" },
      take: limit,
    });
    return rows.map(convertSubscriptionRow);
  }

  public async update(subscriptionId: string, from: readonly CreatorSubscriptionStatus[], change: CreatorSubscriptionChange): Promise<CreatorSubscriptionRecord | undefined> {
    const result = await prisma().creatorSubscription.updateMany({ where: { id: subscriptionId, status: { in: [...from] } }, data: change });
    return result.count === 0 ? undefined : this.findById(subscriptionId);
  }

  public async createCharge(input: NewCreatorSubscriptionCharge): Promise<CreatorSubscriptionChargeRecord> {
    return convertChargeRow(await prisma().creatorSubscriptionCharge.create({ data: { ...input, amount: BigInt(input.amount) } }));
  }

  public async findChargeByReference(reference: string): Promise<CreatorSubscriptionChargeRecord | undefined> {
    const row = await prisma().creatorSubscriptionCharge.findUnique({ where: { reference } });
    return row === null ? undefined : convertChargeRow(row);
  }

  public async changeChargeStatus(chargeId: string, from: CreatorSubscriptionChargeStatus, to: CreatorSubscriptionChargeStatus, change: CreatorSubscriptionChargeChange): Promise<boolean> {
    return (await prisma().creatorSubscriptionCharge.updateMany({ where: { id: chargeId, status: from }, data: { ...change, status: to } })).count === 1;
  }
}
