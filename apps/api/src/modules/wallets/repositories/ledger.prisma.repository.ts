import { isUniqueConstraintViolation, runInSerializableTransaction, type TransactionClient } from "../../../databases/prisma.database.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { insufficientFunds } from "../../../errors/domain.error.js";
import type { LedgerAccount, LedgerEntry } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { convertDatabaseAmountToMinorUnits, CurrencyMismatchError } from "../../../utils/money.util.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import {
  calculateBalanceChange,
  type LedgerAccountKind,
  type LedgerAccountRecord,
  type LedgerDirection,
  type LedgerEntryRecord,
  type LedgerLineInput,
  type LedgerPostingResult,
  type LedgerTransactionInput,
  type LedgerTransactionRecord,
} from "../models/wallets.model.js";
import type { LedgerRepository } from "./ledger.repository.js";

type TransactionRow = { id: string; reference: string; kind: string; description: string; createdAt: Date; entries: LedgerEntry[] };

function convertAccountRowToRecord(row: LedgerAccount): LedgerAccountRecord {
  return { ...row, kind: row.kind as LedgerAccountKind, currency: row.currency as CurrencyCode, balance: convertDatabaseAmountToMinorUnits(row.balance) };
}

function convertEntryRowToRecord(row: LedgerEntry, currency: CurrencyCode): LedgerEntryRecord {
  return {
    ...row,
    direction: row.direction as LedgerDirection,
    amount: convertDatabaseAmountToMinorUnits(row.amount),
    currency,
    balanceAfter: convertDatabaseAmountToMinorUnits(row.balanceAfter),
  };
}

async function applyLineToAccount(tx: TransactionClient, line: LedgerLineInput): Promise<{ accountId: string; balanceAfter: bigint }> {
  const account = await tx.ledgerAccount.upsert({
    where: { key: line.account.key },
    create: { ...line.account, currency: line.currency },
    update: {},
  });
  if (account.currency !== line.currency) throw new CurrencyMismatchError(account.currency, line.currency);
  const change = calculateBalanceChange(line.account.kind, line.direction, line.amount);
  const guard = change < 0 && !account.allowNegative ? { balance: { gte: BigInt(-change) } } : {};
  const result = await tx.ledgerAccount.updateMany({
    where: { id: account.id, ...guard },
    data: { balance: { increment: BigInt(change) }, version: { increment: 1 } },
  });
  if (result.count !== 1) throw insufficientFunds();
  const updated = await tx.ledgerAccount.findUniqueOrThrow({ where: { id: account.id } });
  return { accountId: account.id, balanceAfter: updated.balance };
}

export class PrismaLedgerRepository implements LedgerRepository {
  public async postBalancedTransaction(input: LedgerTransactionInput, postedAt: Date): Promise<LedgerPostingResult> {
    try {
      return await runInSerializableTransaction(async (tx) => {
        const existing = await tx.ledgerTransaction.findUnique({ where: { reference: input.reference }, include: { entries: true } });
        if (existing !== null) return { transaction: await this.convertTransaction(existing, tx), created: false };
        const applied = [];
        for (const line of input.lines) applied.push({ line, ...(await applyLineToAccount(tx, line)) });
        const row = await tx.ledgerTransaction.create({
          data: {
            reference: input.reference,
            kind: input.kind,
            description: input.description,
            createdAt: postedAt,
            entries: {
              create: applied.map(({ line, accountId, balanceAfter }) => ({
                accountId,
                direction: line.direction,
                amount: BigInt(line.amount),
                balanceAfter,
                createdAt: postedAt,
              })),
            },
          },
          include: { entries: true },
        });
        return { transaction: await this.convertTransaction(row, tx), created: true };
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const existing = await this.findTransactionByReference(input.reference);
      if (existing === undefined) throw error;
      return { transaction: existing, created: false };
    }
  }

  public async findAccountByKey(key: string): Promise<LedgerAccountRecord | undefined> {
    const row = await prisma().ledgerAccount.findUnique({ where: { key } });
    return row === null ? undefined : convertAccountRowToRecord(row);
  }

  public async findTransactionByReference(reference: string): Promise<LedgerTransactionRecord | undefined> {
    const row = await prisma().ledgerTransaction.findUnique({ where: { reference }, include: { entries: true } });
    return row === null ? undefined : this.convertTransaction(row, prisma());
  }

  public async listEntriesForAccount(accountKey: string, page: PageRequest): Promise<Page<LedgerEntryRecord>> {
    const account = await prisma().ledgerAccount.findUnique({ where: { key: accountKey } });
    if (account === null) return { data: [], nextCursor: null };
    const rows = await prisma().ledgerEntry.findMany({
      where: { accountId: account.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), (row) => convertEntryRowToRecord(row, account.currency as CurrencyCode));
  }

  private async convertTransaction(row: TransactionRow, client: TransactionClient): Promise<LedgerTransactionRecord> {
    const accounts = await client.ledgerAccount.findMany({ where: { id: { in: row.entries.map((entry) => entry.accountId) } } });
    const currencyByAccountId = new Map(accounts.map((account) => [account.id, account.currency as CurrencyCode]));
    return {
      id: row.id,
      reference: row.reference,
      kind: row.kind,
      description: row.description,
      createdAt: row.createdAt,
      entries: row.entries.map((entry) => convertEntryRowToRecord(entry, currencyByAccountId.get(entry.accountId) ?? ("USD" as CurrencyCode))),
    };
  }
}
