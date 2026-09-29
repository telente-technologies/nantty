import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { AdPaymentMethodChanges, AdPaymentMethodRecord, AdPaymentProvider, AdTopUpRecord, AdTopUpStatus, FundingMode, NewAdPaymentMethodInput, NewAdTopUpInput } from "../models/adBilling.model.js";
import type { AdBillingSettingsRepository } from "./adBillingSettings.repository.js";

type TopUpRow = Awaited<ReturnType<ReturnType<typeof prisma>["adTopUp"]["create"]>>;
type MethodRow = Awaited<ReturnType<ReturnType<typeof prisma>["adPaymentMethod"]["create"]>>;

function toTopUp(row: TopUpRow): AdTopUpRecord {
  return { ...row, amountMinor: Number(row.amountMinor), currency: row.currency as CurrencyCode, provider: row.provider as AdPaymentProvider, status: row.status as AdTopUpStatus };
}

function toMethod(row: MethodRow): AdPaymentMethodRecord {
  return { ...row, provider: row.provider as AdPaymentProvider, status: row.status as AdPaymentMethodRecord["status"] };
}

export class PrismaAdBillingSettingsRepository implements AdBillingSettingsRepository {
  public async findFundingMode(accountId: string): Promise<FundingMode> {
    const row = await prisma().adAccountBillingSettings.findUnique({ where: { accountId } });
    return (row?.fundingMode as FundingMode | undefined) ?? "prepaid";
  }

  public async saveFundingMode(accountId: string, fundingMode: FundingMode): Promise<void> {
    await prisma().adAccountBillingSettings.upsert({ where: { accountId }, create: { accountId, fundingMode }, update: { fundingMode } });
  }

  public async createTopUp(input: NewAdTopUpInput): Promise<AdTopUpRecord> {
    return toTopUp(await prisma().adTopUp.create({ data: { ...input, amountMinor: BigInt(input.amountMinor) } }));
  }

  public async findTopUpByReference(reference: string): Promise<AdTopUpRecord | undefined> {
    const row = await prisma().adTopUp.findUnique({ where: { reference } });
    return row === null ? undefined : toTopUp(row);
  }

  public async completeTopUp(topUpId: string, status: AdTopUpStatus, completedAt: Date | null, failureReason: string | null): Promise<boolean> {
    const updated = await prisma().adTopUp.updateMany({ where: { id: topUpId, status: "pending" }, data: { status, completedAt, failureReason } });
    return updated.count === 1;
  }

  public async createPaymentMethod(input: NewAdPaymentMethodInput): Promise<AdPaymentMethodRecord> {
    return toMethod(await prisma().adPaymentMethod.create({ data: { ...input, expYear: input.createdAt.getUTCFullYear() + 3 } }));
  }

  public async listPaymentMethods(accountId: string): Promise<readonly AdPaymentMethodRecord[]> {
    return (await prisma().adPaymentMethod.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } })).map(toMethod);
  }

  public async updatePaymentMethod(paymentMethodId: string, changes: AdPaymentMethodChanges): Promise<void> {
    await prisma().adPaymentMethod.updateMany({ where: { id: paymentMethodId }, data: changes });
  }

  public async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    await prisma().adPaymentMethod.deleteMany({ where: { id: paymentMethodId } });
  }
}
