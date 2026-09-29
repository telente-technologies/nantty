import type { CoinPurchaseChannel, CoinPurchasePlatform } from "../../../configs/monetization.config.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { CoinPurchase } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import type { CoinPurchaseRecord, CoinPurchaseStatus, CoinPurchaseStatusChange, NewCoinPurchase } from "../models/coins.model.js";
import type { CoinPurchasesRepository } from "./coinPurchases.repository.js";

function convertCoinPurchaseRow(row: CoinPurchase): CoinPurchaseRecord {
  return {
    ...row,
    amount: convertDatabaseAmountToMinorUnits(row.amount),
    currency: row.currency as CurrencyCode,
    channel: row.channel as CoinPurchaseChannel,
    platform: row.platform as CoinPurchasePlatform,
    status: row.status as CoinPurchaseStatus,
  };
}

export class PrismaCoinPurchasesRepository implements CoinPurchasesRepository {
  public async create(input: NewCoinPurchase): Promise<CoinPurchaseRecord> {
    return convertCoinPurchaseRow(await prisma().coinPurchase.create({ data: { ...input, amount: BigInt(input.amount) } }));
  }

  public async saveAuthorizationUrl(purchaseId: string, authorizationUrl: string): Promise<void> {
    await prisma().coinPurchase.updateMany({ where: { id: purchaseId }, data: { authorizationUrl } });
  }

  public async findByReference(reference: string): Promise<CoinPurchaseRecord | undefined> {
    const row = await prisma().coinPurchase.findUnique({ where: { reference } });
    return row === null ? undefined : convertCoinPurchaseRow(row);
  }

  public async changeStatus(purchaseId: string, from: CoinPurchaseStatus, to: CoinPurchaseStatus, change: CoinPurchaseStatusChange): Promise<boolean> {
    return (await prisma().coinPurchase.updateMany({ where: { id: purchaseId, status: from }, data: { ...change, status: to } })).count === 1;
  }
}
