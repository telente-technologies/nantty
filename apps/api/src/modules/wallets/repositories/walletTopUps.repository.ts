import { randomUUID } from "node:crypto";

import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { WalletTopUp } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import type { NewWalletTopUp, WalletTopUpRecord, WalletTopUpStatus } from "../models/wallets.model.js";

export interface WalletTopUpStatusChange {
  readonly providerTransactionId?: string | null;
  readonly creditedAt?: Date;
}

export interface WalletTopUpsRepository {
  create(input: NewWalletTopUp): Promise<WalletTopUpRecord>;
  saveAuthorizationUrl(topUpId: string, authorizationUrl: string): Promise<void>;
  findByReference(reference: string): Promise<WalletTopUpRecord | undefined>;
  changeStatus(topUpId: string, from: WalletTopUpStatus, to: WalletTopUpStatus, change: WalletTopUpStatusChange): Promise<boolean>;
}

export class InMemoryWalletTopUpsRepository implements WalletTopUpsRepository {
  private readonly topUps = new Map<string, WalletTopUpRecord>();

  public async create(input: NewWalletTopUp): Promise<WalletTopUpRecord> {
    const topUp: WalletTopUpRecord = { ...input, id: randomUUID(), status: "pending", authorizationUrl: null, providerTransactionId: null, creditedAt: null, createdAt: new Date() };
    this.topUps.set(topUp.id, topUp);
    return topUp;
  }

  public async saveAuthorizationUrl(topUpId: string, authorizationUrl: string): Promise<void> {
    const topUp = this.topUps.get(topUpId);
    if (topUp !== undefined) this.topUps.set(topUpId, { ...topUp, authorizationUrl });
  }

  public async findByReference(reference: string): Promise<WalletTopUpRecord | undefined> {
    return [...this.topUps.values()].find((topUp) => topUp.reference === reference);
  }

  public async changeStatus(topUpId: string, from: WalletTopUpStatus, to: WalletTopUpStatus, change: WalletTopUpStatusChange): Promise<boolean> {
    const topUp = this.topUps.get(topUpId);
    if (topUp?.status !== from) return false;
    this.topUps.set(topUpId, { ...topUp, ...change, status: to });
    return true;
  }
}

function convertTopUpRowToRecord(row: WalletTopUp): WalletTopUpRecord {
  return { ...row, amount: convertDatabaseAmountToMinorUnits(row.amount), currency: row.currency as CurrencyCode, status: row.status as WalletTopUpStatus };
}

export class PrismaWalletTopUpsRepository implements WalletTopUpsRepository {
  public async create(input: NewWalletTopUp): Promise<WalletTopUpRecord> {
    return convertTopUpRowToRecord(await prisma().walletTopUp.create({ data: { ...input, amount: BigInt(input.amount) } }));
  }

  public async saveAuthorizationUrl(topUpId: string, authorizationUrl: string): Promise<void> {
    await prisma().walletTopUp.updateMany({ where: { id: topUpId }, data: { authorizationUrl } });
  }

  public async findByReference(reference: string): Promise<WalletTopUpRecord | undefined> {
    const row = await prisma().walletTopUp.findUnique({ where: { reference } });
    return row === null ? undefined : convertTopUpRowToRecord(row);
  }

  public async changeStatus(topUpId: string, from: WalletTopUpStatus, to: WalletTopUpStatus, change: WalletTopUpStatusChange): Promise<boolean> {
    return (await prisma().walletTopUp.updateMany({ where: { id: topUpId, status: from }, data: { ...change, status: to } })).count === 1;
  }
}
