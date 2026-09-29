import type { ProfileSubscription, SubscriptionCharge } from "../../../generated/prisma/client.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { ProfileType, VerificationTier } from "../../../interfaces/verificationBadge.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { ProfileKind } from "../../verifications/models/verifications.model.js";
import type {
  BillingInterval,
  ChargeKind,
  ChargeStatus,
  NewSubscription,
  NewSubscriptionCharge,
  SubscriptionChargeRecord,
  SubscriptionFilter,
  SubscriptionPatch,
  SubscriptionRecord,
  SubscriptionStatus,
} from "../models/subscriptions.model.js";
import type { ChargeStatusChange, SubscriptionChargesRepository, SubscriptionsRepository } from "./subscriptions.repository.js";

function convertSubscriptionRowToRecord(row: ProfileSubscription): SubscriptionRecord {
  return {
    ...row,
    profileKind: row.profileKind as ProfileKind,
    profileType: row.profileType as ProfileType,
    plan: row.plan as VerificationTier,
    status: row.status as SubscriptionStatus,
    interval: row.interval as BillingInterval,
    currency: row.currency as CurrencyCode | null,
    amount: row.amount === null ? null : convertDatabaseAmountToMinorUnits(row.amount),
  };
}

function convertChargeRowToRecord(row: SubscriptionCharge): SubscriptionChargeRecord {
  return {
    ...row,
    profileKind: row.profileKind as ProfileKind,
    profileType: row.profileType as ProfileType,
    plan: row.plan as VerificationTier,
    interval: row.interval as BillingInterval,
    kind: row.kind as ChargeKind,
    status: row.status as ChargeStatus,
    currency: row.currency as CurrencyCode,
    amount: convertDatabaseAmountToMinorUnits(row.amount),
  };
}

function convertPatchToColumns(patch: SubscriptionPatch) {
  const { amount, ...rest } = patch;
  return { ...rest, ...(amount === undefined ? {} : { amount: amount === null ? null : BigInt(amount) }) };
}

export class PrismaSubscriptionsRepository implements SubscriptionsRepository {
  public async findByProfileId(profileId: string): Promise<SubscriptionRecord | undefined> {
    const row = await prisma().profileSubscription.findUnique({ where: { profileId } });
    return row === null ? undefined : convertSubscriptionRowToRecord(row);
  }

  public async create(input: NewSubscription): Promise<SubscriptionRecord> {
    return convertSubscriptionRowToRecord(await prisma().profileSubscription.create({ data: convertPatchToColumns(input) as NewSubscription & { amount: bigint | null } }));
  }

  public async update(profileId: string, patch: SubscriptionPatch, updatedAt: Date): Promise<SubscriptionRecord> {
    return convertSubscriptionRowToRecord(await prisma().profileSubscription.update({ where: { profileId }, data: { ...convertPatchToColumns(patch), updatedAt } }));
  }

  public async list(filter: SubscriptionFilter, page: PageRequest): Promise<Page<SubscriptionRecord>> {
    const rows = await prisma().profileSubscription.findMany({
      where: { ...(filter.status === undefined ? {} : { status: filter.status }), ...(filter.plan === undefined ? {} : { plan: filter.plan }) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertSubscriptionRowToRecord);
  }

  public async listDueForBilling(now: Date, limit: number): Promise<readonly SubscriptionRecord[]> {
    const rows = await prisma().profileSubscription.findMany({
      where: { OR: [{ status: "PAST_DUE" }, { status: { in: ["ACTIVE", "TRIALING", "CANCELLED"] }, endsAt: { lte: now } }] },
      orderBy: { endsAt: "asc" },
      take: limit,
    });
    return rows.map(convertSubscriptionRowToRecord);
  }
}

export class PrismaSubscriptionChargesRepository implements SubscriptionChargesRepository {
  public async create(input: NewSubscriptionCharge): Promise<SubscriptionChargeRecord> {
    return convertChargeRowToRecord(await prisma().subscriptionCharge.create({ data: { ...input, amount: BigInt(input.amount) } }));
  }

  public async findByReference(reference: string): Promise<SubscriptionChargeRecord | undefined> {
    const row = await prisma().subscriptionCharge.findUnique({ where: { reference } });
    return row === null ? undefined : convertChargeRowToRecord(row);
  }

  public async changeStatus(chargeId: string, from: ChargeStatus, to: ChargeStatus, change: ChargeStatusChange): Promise<boolean> {
    return (await prisma().subscriptionCharge.updateMany({ where: { id: chargeId, status: from }, data: { ...change, status: to } })).count === 1;
  }
}
