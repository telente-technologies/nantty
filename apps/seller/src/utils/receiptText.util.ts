import type { PosSale } from "@/types/pos.type";
import type { PaymentMethod, StoreSettings } from "@/types/store.type";
import type { Money } from "@/types/money.type";

export const receiptPaymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  zudomart_wallet: "Zudomart wallet",
  pay_link: "Pay link",
};

export function readReceiptCharactersPerLine(settings: StoreSettings): number {
  return settings.receipt.paperWidth === "58mm" ? 32 : 42;
}

function padReceiptColumns(left: string, right: string, width: number): string {
  const space = width - right.length;
  const trimmedLeft = left.length > space - 1 ? `${left.slice(0, Math.max(space - 2, 1))}…` : left;
  return `${trimmedLeft}${" ".repeat(Math.max(1, space - trimmedLeft.length))}${right}`;
}

function wrapReceiptText(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    if ((currentLine ? `${currentLine} ${word}` : word).length > width) {
      if (currentLine) lines.push(currentLine);
      currentLine = word.slice(0, width);
    } else currentLine = currentLine ? `${currentLine} ${word}` : word;
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function centerReceiptText(text: string, width: number): string {
  return wrapReceiptText(text, width).map((line) => `${" ".repeat(Math.max(0, Math.floor((width - line.length) / 2)))}${line}`).join("\n");
}

export interface ReceiptTextOptions {
  readonly settings: StoreSettings;
  readonly locationName: string | null;
  readonly formatAmount: (money: Money) => string;
  readonly formatDateTime: (isoDate: string) => string;
  readonly isPendingSync: boolean;
}

export function buildReceiptTextLines(sale: PosSale, options: ReceiptTextOptions): string[] {
  const { settings, formatAmount } = options;
  const width = readReceiptCharactersPerLine(settings);
  const divider = "-".repeat(width);
  const lines: string[] = [centerReceiptText(settings.name, width), ...(options.locationName ? [centerReceiptText(options.locationName, width)] : []), centerReceiptText(settings.phone, width)];
  if (settings.receipt.headerText) lines.push(centerReceiptText(settings.receipt.headerText, width));
  lines.push(divider, padReceiptColumns("Receipt", options.isPendingSync ? "PENDING SYNC" : sale.receiptNumber, width), padReceiptColumns("Date", options.formatDateTime(sale.offlineCreatedAt ?? sale.createdAt), width));
  if (settings.receipt.showCashierName) lines.push(padReceiptColumns("Cashier", sale.cashier.name, width));
  if (sale.customer) lines.push(padReceiptColumns("Customer", sale.customer.name, width));
  lines.push(divider);
  for (const line of sale.lines) {
    lines.push(...wrapReceiptText(`${line.name}${line.variantTitle !== "Default" ? ` (${line.variantTitle})` : ""}`, width));
    lines.push(padReceiptColumns(`  ${line.quantity} x ${formatAmount(line.unitPrice)}`, formatAmount(line.lineTotal), width));
    if (line.discountAmount.amountMinor > 0) lines.push(padReceiptColumns("  Discount", `-${formatAmount(line.discountAmount)}`, width));
  }
  lines.push(divider, padReceiptColumns("Subtotal", formatAmount(sale.subtotal), width));
  if (sale.discountTotal.amountMinor > 0) lines.push(padReceiptColumns("Discounts", `-${formatAmount(sale.discountTotal)}`, width));
  lines.push(padReceiptColumns(settings.pricesIncludeTax ? "Tax included" : "Tax", formatAmount(sale.taxTotal), width), padReceiptColumns("TOTAL", formatAmount(sale.total), width), divider);
  for (const payment of sale.payments) {
    lines.push(padReceiptColumns(receiptPaymentMethodLabels[payment.method], formatAmount(payment.tendered ?? payment.amount), width));
    if (payment.reference) lines.push(`  Ref ${payment.reference}`);
  }
  if (sale.changeDue.amountMinor > 0) lines.push(padReceiptColumns("Change", formatAmount(sale.changeDue), width));
  if (sale.loyaltyPointsEarned > 0) lines.push(padReceiptColumns("Points earned", String(sale.loyaltyPointsEarned), width));
  lines.push(divider);
  if (settings.receipt.returnPolicy) lines.push(...wrapReceiptText(settings.receipt.returnPolicy, width));
  if (settings.receipt.footerText) lines.push("", centerReceiptText(settings.receipt.footerText, width));
  return lines.flatMap((line) => line.split("\n"));
}
