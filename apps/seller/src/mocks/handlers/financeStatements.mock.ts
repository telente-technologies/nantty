import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { convertIsoToStoreDateKey } from "@/mocks/handlers/reportSalesRecords.mock";
import type { StatementDetail, StatementLine, StatementMonthSummary } from "@/types/finance.type";
import type { WalletTransaction } from "@/types/wallet.type";

function readSignedAvailableMinor(transaction: WalletTransaction): number {
  if (transaction.balanceBucket !== "available") return 0;
  return transaction.direction === "credit" ? transaction.amount.amountMinor : -transaction.amount.amountMinor;
}

function listChronologicalStatementLines(): StatementLine[] {
  const database = readMockDatabase();
  const chronological = [...database.wallet.transactions].sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  const netMovementMinor = chronological.reduce((sum, transaction) => sum + readSignedAvailableMinor(transaction), 0);
  let lowestPrefixMinor = 0;
  let prefixMinor = 0;
  for (const transaction of chronological) {
    prefixMinor += readSignedAvailableMinor(transaction);
    lowestPrefixMinor = Math.min(lowestPrefixMinor, prefixMinor);
  }
  let runningMinor = Math.max(database.wallet.balances.available.amountMinor - netMovementMinor, -lowestPrefixMinor);
  return chronological.map((transaction) => {
    runningMinor += readSignedAvailableMinor(transaction);
    return { ...transaction, runningBalance: { amountMinor: runningMinor, currency: transaction.amount.currency } };
  });
}

function readMonthKey(isoDate: string): string {
  return convertIsoToStoreDateKey(isoDate, readMockDatabase().settings.timezone).slice(0, 7);
}

function summariseStatementMonth(month: string, everyLine: readonly StatementLine[]): StatementMonthSummary {
  const currency = readMockDatabase().settings.currency;
  const monthLines = everyLine.filter((line) => readMonthKey(line.createdAt) === month);
  const linesBefore = everyLine.filter((line) => readMonthKey(line.createdAt) < month);
  const firstLine = monthLines[0];
  const openingMinor = linesBefore.length > 0 ? (linesBefore[linesBefore.length - 1] as StatementLine).runningBalance.amountMinor : firstLine ? firstLine.runningBalance.amountMinor - readSignedAvailableMinor(firstLine) : 0;
  const creditsMinor = monthLines.reduce((sum, line) => sum + Math.max(0, readSignedAvailableMinor(line)), 0);
  const debitsMinor = monthLines.reduce((sum, line) => sum + Math.max(0, -readSignedAvailableMinor(line)), 0);
  return {
    month,
    openingBalance: { amountMinor: openingMinor, currency },
    credits: { amountMinor: creditsMinor, currency },
    debits: { amountMinor: debitsMinor, currency },
    closingBalance: { amountMinor: openingMinor + creditsMinor - debitsMinor, currency },
    transactionsCount: monthLines.length,
  };
}

export function listStatementMonthSummaries(): StatementMonthSummary[] {
  const everyLine = listChronologicalStatementLines();
  const currentMonth = readMonthKey(new Date().toISOString());
  const months: string[] = [];
  const cursor = new Date(`${currentMonth}-15T12:00:00.000Z`);
  for (let index = 0; index < 12; index += 1) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  return months.map((month) => summariseStatementMonth(month, everyLine));
}

export function buildStatementDetailForMonth(month: string): StatementDetail {
  const database = readMockDatabase();
  const everyLine = listChronologicalStatementLines();
  return {
    summary: summariseStatementMonth(month, everyLine),
    storeName: database.settings.name,
    storeAddress: database.settings.address,
    generatedAt: new Date().toISOString(),
    lines: everyLine.filter((line) => readMonthKey(line.createdAt) === month),
  };
}
