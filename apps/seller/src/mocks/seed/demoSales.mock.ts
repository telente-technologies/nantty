import type { Customer } from "@/types/customer.type";
import type { Product } from "@/types/catalog.type";
import type { PaymentMethod, StoreSettings } from "@/types/store.type";
import type { PosSale, PosShift, SalePayment } from "@/types/pos.type";
import type { Money } from "@/types/money.type";
import { calculateCartTotalsInMinorUnits } from "@/utils/posCartPricing.util";
import type { DemoPosHistoryPlan } from "@/mocks/seed/demoStoreProfile.mock";
import { createSeededRandomNumberGenerator, pickRandomIntegerInclusive, pickRandomItem } from "@/mocks/seed/seededRandom.mock";

function pickPaymentPlan(random: () => number): PaymentMethod[] {
  const roll = random();
  if (roll < 0.48) return ["cash"];
  if (roll < 0.74) return ["card"];
  if (roll < 0.9) return ["bank_transfer"];
  if (roll < 0.95) return ["zudomart_wallet"];
  return ["cash", "card"];
}

function buildPaymentsForTotal(totalMinor: number, methods: PaymentMethod[], random: () => number, idPrefix: string, toStoreMoney: (amountMinor: number) => Money): { payments: SalePayment[]; changeMinor: number } {
  const payments: SalePayment[] = [];
  let remainingMinor = totalMinor;
  let changeMinor = 0;
  methods.forEach((method, index) => {
    const isLastMethod = index === methods.length - 1;
    const amountMinor = isLastMethod ? remainingMinor : Math.round(remainingMinor * 0.4 / 100_000) * 100_000;
    remainingMinor -= amountMinor;
    const tenderedMinor = method === "cash" ? Math.ceil(amountMinor / 100_000) * 100_000 + (random() < 0.3 ? 100_000 : 0) : null;
    if (tenderedMinor !== null) changeMinor += tenderedMinor - amountMinor;
    payments.push({
      id: `${idPrefix}_pay_${index + 1}`,
      method,
      amount: toStoreMoney(amountMinor),
      tendered: tenderedMinor === null ? null : toStoreMoney(tenderedMinor),
      change: tenderedMinor === null ? null : toStoreMoney(tenderedMinor - amountMinor),
      reference: method === "card" ? `APPR${pickRandomIntegerInclusive(100000, 999999, random)}` : method === "bank_transfer" ? `TRF${pickRandomIntegerInclusive(1000000, 9999999, random)}` : null,
      status: "captured",
    });
  });
  return { payments, changeMinor };
}

export interface DemoSalesHistory {
  readonly shifts: PosShift[];
  readonly sales: PosSale[];
}

export interface DemoSalesHistoryOptions {
  readonly plan: DemoPosHistoryPlan;
  readonly randomSeed: number;
  readonly receiptPrefix: string;
  readonly highVolumeCategoryIds: readonly string[];
}

export function buildDemoSalesHistory(products: readonly Product[], customers: Customer[], settings: StoreSettings, options: DemoSalesHistoryOptions): DemoSalesHistory {
  const { plan, receiptPrefix, highVolumeCategoryIds } = options;
  const random = createSeededRandomNumberGenerator(options.randomSeed);
  const toStoreMoney = (amountMinor: number): Money => ({ amountMinor, currency: settings.currency });
  const shifts: PosShift[] = [];
  const sales: PosSale[] = [];
  let receiptSequence = plan.firstReceiptSequence;

  for (let daysAgo = plan.historyLengthInDays; daysAgo >= 0; daysAgo -= 1) {
    for (const { registerId, locationId, cashier } of plan.registerCashiers) {
      if (daysAgo === 0 && !plan.registersWithOpenShiftToday.includes(registerId)) continue;
      if (daysAgo > 0 && random() < 0.12) continue;
      const shiftId = `shf_${registerId}_${daysAgo}`;
      const openedAt = new Date();
      openedAt.setUTCDate(openedAt.getUTCDate() - daysAgo);
      openedAt.setUTCHours(7, pickRandomIntegerInclusive(0, 40, random), 0, 0);
      const isOpenShift = daysAgo === 0;
      const [minimumSales, maximumSales] = isOpenShift ? plan.salesPerOpenShift : plan.salesPerClosedShift;
      const salesCountForShift = pickRandomIntegerInclusive(minimumSales, maximumSales, random);
      const byMethod = new Map<PaymentMethod, number>();
      let grossMinor = 0;
      let cashTakenMinor = 0;

      for (let saleIndex = 0; saleIndex < salesCountForShift; saleIndex += 1) {
        const lineCount = pickRandomIntegerInclusive(1, 4, random);
        const chosenLines = Array.from({ length: lineCount }, () => {
          const product = pickRandomItem(products, random);
          const variant = pickRandomItem(product.variants, random);
          return { product, variant, quantity: product.categoryId !== null && highVolumeCategoryIds.includes(product.categoryId) ? pickRandomIntegerInclusive(1, 4, random) : 1 };
        });
        const priced = calculateCartTotalsInMinorUnits({
          currency: settings.currency,
          lines: chosenLines.map(({ product, variant, quantity }) => ({ unitPriceMinor: variant.price.amountMinor, quantity, taxable: product.taxable, categoryId: product.categoryId, discount: null })),
          cartDiscount: random() < 0.08 ? { kind: "percent", value: 1000, reason: "Loyal customer", approvedByStaffId: null } : null,
          couponDiscount: null,
          loyaltyRedemptionMinor: 0,
          taxes: settings.taxes,
          pricesIncludeTax: settings.pricesIncludeTax,
        });
        const saleId = `sale_${registerId}_${daysAgo}_${saleIndex}`;
        const { payments, changeMinor } = buildPaymentsForTotal(priced.totalMinor, pickPaymentPlan(random), random, saleId, toStoreMoney);
        const customer = customers.length > 0 && random() < plan.customerShare ? pickRandomItem(customers, random) : null;
        const createdAt = new Date(openedAt.getTime() + (saleIndex + 1) * pickRandomIntegerInclusive(15, 40, random) * 60_000);
        receiptSequence += 1;
        grossMinor += priced.totalMinor;
        for (const payment of payments) {
          byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + payment.amount.amountMinor);
          if (payment.method === "cash") cashTakenMinor += payment.amount.amountMinor;
        }
        sales.push({
          id: saleId,
          receiptNumber: `${receiptPrefix}-${receiptSequence}`,
          locationId,
          registerId,
          shiftId,
          cashier,
          customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
          lines: chosenLines.map(({ product, variant, quantity }, lineIndex) => {
            const pricedLine = priced.lines[lineIndex];
            return {
              id: `${saleId}_line_${lineIndex + 1}`,
              productId: product.id,
              variantId: variant.id,
              name: product.name,
              variantTitle: variant.title,
              sku: variant.sku,
              quantity,
              unitPrice: variant.price,
              discount: null,
              discountAmount: toStoreMoney((pricedLine?.lineDiscountMinor ?? 0) + (pricedLine?.cartDiscountShareMinor ?? 0)),
              taxAmount: toStoreMoney(pricedLine?.taxMinor ?? 0),
              lineTotal: toStoreMoney(pricedLine?.totalMinor ?? 0),
              refundedQuantity: 0,
            };
          }),
          cartDiscount: priced.cartDiscountMinor > 0 ? { kind: "percent", value: 1000, reason: "Loyal customer", approvedByStaffId: null } : null,
          couponCode: null,
          subtotal: toStoreMoney(priced.subtotalMinor),
          discountTotal: toStoreMoney(priced.discountTotalMinor),
          taxTotal: toStoreMoney(priced.taxTotalMinor),
          total: toStoreMoney(priced.totalMinor),
          payments,
          changeDue: toStoreMoney(changeMinor),
          loyaltyPointsEarned: customer ? Math.floor(priced.totalMinor / 100 / 1000) : 0,
          loyaltyPointsRedeemed: 0,
          status: "completed",
          refundIds: [],
          createdAt: createdAt.toISOString(),
          offlineCreatedAt: null,
          clientSaleId: `client_${saleId}`,
        });
        if (customer) {
          Object.assign(customer, {
            totalSpent: toStoreMoney(customer.totalSpent.amountMinor + priced.totalMinor),
            purchasesCount: customer.purchasesCount + 1,
            lastPurchaseAt: createdAt.toISOString(),
          });
        }
      }

      const openingFloatMinor = plan.openingFloatMinor;
      const expectedCashMinor = openingFloatMinor + cashTakenMinor;
      const varianceMinor = isOpenShift ? 0 : pickRandomItem([0, 0, 0, -50_000, 20_000, -100_000], random);
      const closedAt = new Date(openedAt.getTime() + 11 * 3_600_000);
      shifts.push({
        id: shiftId,
        registerId,
        locationId,
        status: isOpenShift ? "open" : "closed",
        openedBy: cashier,
        openedAt: openedAt.toISOString(),
        openingFloat: toStoreMoney(openingFloatMinor),
        cashMovements: [],
        totals: {
          salesCount: salesCountForShift,
          grossSales: toStoreMoney(grossMinor),
          refunds: toStoreMoney(0),
          netSales: toStoreMoney(grossMinor),
          byPaymentMethod: [...byMethod.entries()].map(([method, amountMinor]) => ({ method, amount: toStoreMoney(amountMinor) })),
        },
        expectedCash: toStoreMoney(expectedCashMinor),
        closedBy: isOpenShift ? null : cashier,
        closedAt: isOpenShift ? null : closedAt.toISOString(),
        countedCash: isOpenShift ? null : toStoreMoney(expectedCashMinor + varianceMinor),
        cashVariance: isOpenShift ? null : toStoreMoney(varianceMinor),
        closingNote: varianceMinor < 0 ? "Short — checked twice." : null,
      });
    }
  }
  return { shifts, sales: sales.reverse() };
}
