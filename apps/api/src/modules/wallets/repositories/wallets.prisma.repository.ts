import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { PayoutAccount, Withdrawal } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import {
  describeWalletOwner,
  type NewPayoutAccount,
  type NewWithdrawal,
  type PayoutAccountRecord,
  type WalletOwner,
  type WithdrawalRecord,
  type WithdrawalStatus,
} from "../models/wallets.model.js";
import type { PayoutAccountsRepository, WithdrawalsRepository } from "./wallets.repository.js";

function convertPayoutAccountRowToRecord(row: PayoutAccount): PayoutAccountRecord {
  const { accountNumberEnc, ...rest } = row;
  return { ...rest, accountNumberEncrypted: accountNumberEnc };
}

function convertWithdrawalRowToRecord(row: Withdrawal): WithdrawalRecord {
  return { ...row, amount: convertDatabaseAmountToMinorUnits(row.amount), fee: convertDatabaseAmountToMinorUnits(row.fee), currency: row.currency as CurrencyCode, status: row.status as WithdrawalStatus };
}

export class PrismaPayoutAccountsRepository implements PayoutAccountsRepository {
  public async listForOwner(owner: WalletOwner): Promise<readonly PayoutAccountRecord[]> {
    const rows = await prisma().payoutAccount.findMany({ where: describeWalletOwner(owner), orderBy: { createdAt: "asc" } });
    return rows.map(convertPayoutAccountRowToRecord);
  }

  public async findForOwner(owner: WalletOwner, payoutAccountId: string): Promise<PayoutAccountRecord | undefined> {
    const row = await prisma().payoutAccount.findFirst({ where: { id: payoutAccountId, ...describeWalletOwner(owner) } });
    return row === null ? undefined : convertPayoutAccountRowToRecord(row);
  }

  public async create(input: NewPayoutAccount): Promise<PayoutAccountRecord> {
    const { accountNumberEncrypted, ...rest } = input;
    return convertPayoutAccountRowToRecord(await prisma().payoutAccount.create({ data: { ...rest, accountNumberEnc: accountNumberEncrypted } }));
  }

  public async delete(owner: WalletOwner, payoutAccountId: string): Promise<boolean> {
    return (await prisma().payoutAccount.deleteMany({ where: { id: payoutAccountId, ...describeWalletOwner(owner) } })).count > 0;
  }

  public async saveRecipientCode(payoutAccountId: string, recipientCode: string): Promise<void> {
    await prisma().payoutAccount.updateMany({ where: { id: payoutAccountId }, data: { recipientCode } });
  }
}

export class PrismaWithdrawalsRepository implements WithdrawalsRepository {
  public async create(input: NewWithdrawal): Promise<WithdrawalRecord> {
    return convertWithdrawalRowToRecord(await prisma().withdrawal.create({ data: { ...input, amount: BigInt(input.amount), fee: BigInt(input.fee) } }));
  }

  public async findById(id: string): Promise<WithdrawalRecord | undefined> {
    const row = await prisma().withdrawal.findUnique({ where: { id } });
    return row === null ? undefined : convertWithdrawalRowToRecord(row);
  }

  public async listForOwner(owner: WalletOwner, page: PageRequest): Promise<Page<WithdrawalRecord>> {
    const rows = await prisma().withdrawal.findMany({ where: describeWalletOwner(owner), orderBy: [{ createdAt: "desc" }, { id: "desc" }], ...buildPrismaPageArguments(page) });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertWithdrawalRowToRecord);
  }

  public async changeStatus(id: string, from: WithdrawalStatus, to: WithdrawalStatus, processedAt: Date, failureReason: string | null): Promise<boolean> {
    const result = await prisma().withdrawal.updateMany({ where: { id, status: from }, data: { status: to, processedAt, failureReason } });
    return result.count === 1;
  }
}
