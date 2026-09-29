import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { adsError, adsNotFound } from "../../../errors/ads.error.js";
import { Money } from "../../../utils/money.util.js";
import type { AdAccountRecord } from "../models/adAccounts.model.js";
import { RECEIPTED_TRANSACTION_TYPES, VALUE_ADDED_TAX_BASIS_POINTS_BY_CURRENCY } from "../models/adBilling.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";
import { paginateAdsItems, type AdAccountAccess } from "./adAccountAccess.service.js";
import { readMonthPrefix } from "./adBillingAccount.service.js";

export interface BillingDocument {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

function formatMoney(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function renderPdfDocument(title: string, lines: readonly (readonly [string, string])[]): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  page.drawText("Zudomart Ads", { x: 50, y: 780, size: 20, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(title, { x: 50, y: 752, size: 14, font: regular });
  lines.forEach(([label, value], index) => {
    const y = 710 - index * 22;
    page.drawText(label, { x: 50, y, size: 11, font: bold });
    page.drawText(value.replace(/[^\x20-\x7E]/g, "?").slice(0, 70), { x: 200, y, size: 11, font: regular });
  });
  document.setTitle(title);
  document.setProducer("Zudomart");
  return document.save();
}

interface MonthlyInvoice {
  readonly id: string;
  readonly number: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly subtotal: ReturnType<Money["toDto"]>;
  readonly tax: ReturnType<Money["toDto"]>;
  readonly total: ReturnType<Money["toDto"]>;
  readonly status: "paid" | "open";
  readonly issuedAt: string;
}

export class AdBillingDocumentsService {
  public constructor(private readonly dependencies: AdsDependencies, private readonly access: AdAccountAccess) {}

  public async listInvoices(userId: string, accountId: string, cursor: string | undefined, limit: number) {
    const { account } = await this.access.requirePermission(userId, accountId, "billing:view");
    return paginateAdsItems(await this.buildMonthlyInvoices(account), cursor, limit);
  }

  public async downloadInvoice(userId: string, accountId: string, invoiceId: string): Promise<BillingDocument> {
    const { account } = await this.access.requirePermission(userId, accountId, "billing:view");
    const invoice = (await this.buildMonthlyInvoices(account)).find((candidate) => candidate.id === invoiceId);
    if (invoice === undefined) throw adsNotFound("Invoice");
    const bytes = await renderPdfDocument("Tax invoice", [
      ["Invoice", invoice.number],
      ["Ad account", `${account.name} (${account.id})`],
      ["Period", `${invoice.periodStart} to ${invoice.periodEnd}`],
      ["Subtotal", formatMoney(invoice.subtotal.amountMinor, invoice.subtotal.currency)],
      ["VAT", formatMoney(invoice.tax.amountMinor, invoice.tax.currency)],
      ["Total", formatMoney(invoice.total.amountMinor, invoice.total.currency)],
      ["Status", invoice.status],
      ["Issued", invoice.issuedAt],
    ]);
    return { fileName: `${invoice.number}.pdf`, bytes };
  }

  public async downloadReceipt(userId: string, accountId: string, transactionId: string): Promise<BillingDocument> {
    const { account } = await this.access.requirePermission(userId, accountId, "billing:view");
    const transaction = (await this.dependencies.delivery.listBillingTransactions(accountId)).find((candidate) => candidate.id === transactionId);
    if (transaction === undefined) throw adsNotFound("Transaction");
    if (!RECEIPTED_TRANSACTION_TYPES.has(transaction.type)) throw adsError(404, "NO_RECEIPT", "This transaction has no receipt.");
    const bytes = await renderPdfDocument("Payment receipt", [
      ["Ad account", `${account.name} (${account.id})`],
      ["Reference", transaction.reference],
      ["Date", transaction.createdAt.toISOString()],
      ["Amount", formatMoney(Math.abs(transaction.amountMinor), transaction.currency)],
      ["Description", transaction.description],
    ]);
    return { fileName: `receipt-${transaction.reference.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`, bytes };
  }

  private async buildMonthlyInvoices(account: AdAccountRecord): Promise<MonthlyInvoice[]> {
    const now = this.dependencies.clock.now();
    const currentMonth = readMonthPrefix(now);
    const spendByMonth = new Map<string, number>();
    for (const transaction of await this.dependencies.delivery.listBillingTransactions(account.id)) {
      if (transaction.type !== "ad_spend" && transaction.type !== "card_charge") continue;
      const month = readMonthPrefix(transaction.createdAt);
      spendByMonth.set(month, (spendByMonth.get(month) ?? 0) + Math.abs(transaction.amountMinor));
    }
    const taxBasisPoints = VALUE_ADDED_TAX_BASIS_POINTS_BY_CURRENCY[account.currency] ?? 0;
    return [...spendByMonth.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([month, subtotalMinor]) => {
        const [year, monthNumber] = month.split("-").map(Number) as [number, number];
        const periodEnd = new Date(Date.UTC(year, monthNumber, 0));
        const subtotal = Money.of(subtotalMinor, account.currency);
        const tax = subtotal.calculateBasisPointsShareRoundingDown(taxBasisPoints);
        return {
          id: `inv_${month.replace("-", "")}`,
          number: `ZDA-${account.id.slice(0, 8).toUpperCase()}-${month.replace("-", "")}`,
          periodStart: `${month}-01`,
          periodEnd: periodEnd.toISOString().slice(0, 10),
          subtotal: subtotal.toDto(),
          tax: tax.toDto(),
          total: subtotal.add(tax).toDto(),
          status: month === currentMonth ? "open" : "paid",
          issuedAt: (month === currentMonth ? now : new Date(Date.UTC(year, monthNumber, 1))).toISOString(),
        };
      });
  }
}
