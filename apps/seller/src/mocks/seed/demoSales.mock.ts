import type { Customer, } from "@/types/customer.type";
import type { Product } from "@/types/catalog.type";
import type { PaymentMethod, StoreSettings } from "@/types/store.type";
import type { PosSale, PosShift, SalePayment } from "@/types/pos.type";
import type { Money } from "@/types/money.type";
import { calculateCartTotalsInMinorUnits } from "@/utils/posCartPricing.util";
import { createSeededRandomNumberGenerator, pickRandomIntegerInclusive, pickRandomItem } from "@/mocks/seed/seededRandom.mock";

const registerCashiers = [
  { registerId: "reg_lekki_1", locationId: "loc_lekki", cashier: { id: "stf_blessing", name: "Blessing Eze" } },
  { registerId: "reg_lekki_2", locationId: "loc_lekki", cashier: { id: "stf_tunde", name: "Tunde Bakare" } },
  { registerId: "reg_ikeja_1", locationId: "loc_ikeja", cashier: { id: "stf_chidi", name: "Chidi Amadi" } },
  { registerId: "reg_wuse_1", locationId: "loc_wuse", cashier: { id: "stf_amina", name: "Amina Bello" } },
];

const registersWithOpenShiftToday = new Set(["reg_ikeja_1", "reg_wuse_1"]);
const historyLengthInDays = 45;

function naira(amountMinor: number): Money {
  return { amountMinor, currency: "NGN" };
}

function pickPaymentPlan(random: () => number): PaymentMethod[] {
  const roll = random();
  if (roll < 0.48) return ["cash"];
  if (roll < 0.74) return ["card"];
  if (roll < 0.9) return ["bank_transfer"];
  if (roll < 0.95) return ["zudomart_wallet"];
  return ["cash", "card"];
}

function buildPaymentsForTotal(totalMinor: number, methods: PaymentMethod[], random: () => number, idPrefix: string): { payments: SalePayment[]; changeMinor: number } {
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
      amount: naira(amountMinor),
      tendered: tenderedMinor === null ? null : naira(tenderedMinor),
      change: tenderedMinor === null ? null : naira(tenderedMinor - amountMinor),
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

export function buildDemoSalesHistory(products: readonly Product[], customers: Customer[], settings: StoreSettings): DemoSalesHistory {
  const random = createSeededRandomNumberGenerator(4242);
  const shifts: PosShift[] = [];
  const sales: PosSale[] = [];
  let receiptSequence = 1000;

  for (let daysAgo = historyLengthInDays; daysAgo >= 0; daysAgo -= 1) {
    for (const { registerId, locationId, cashier } of registerCashiers) {
      if (daysAgo === 0 && !registersWithOpenShiftToday.has(registerId)) continue;
      if (daysAgo > 0 && random() < 0.12) continue;
      const shiftId = `shf_${registerId}_${daysAgo}`;
      const openedAt = new Date();
      openedAt.setUTCDate(openedAt.getUTCDate() - daysAgo);
      openedAt.setUTCHours(7, pickRandomIntegerInclusive(0, 40, random), 0, 0);
      const isOpenShift = daysAgo === 0;
      const salesCountForShift = isOpenShift ? pickRandomIntegerInclusive(3, 7, random) : pickRandomIntegerInclusive(5, 16, random);
      const byMethod = new Map<PaymentMethod, number>();
      let grossMinor = 0;
      let cashTakenMinor = 0;

      for (let saleIndex = 0; saleIndex < salesCountForShift; saleIndex += 1) {
        const lineCount = pickRandomIntegerInclusive(1, 4, random);
        const chosenLines = Array.from({ length: lineCount }, () => {
          const product = pickRandomItem(products, random);
          const variant = pickRandomItem(product.variants, random);
          return { product, variant, quantity: product.categoryId === "cat_food" ? pickRandomIntegerInclusive(1, 4, random) : 1 };
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
        const { payments, changeMinor } = buildPaymentsForTotal(priced.totalMinor, pickPaymentPlan(random), random, saleId);
        const customer = random() < 0.35 ? pickRandomItem(customers, random) : null;
        const createdAt = new Date(openedAt.getTime() + (saleIndex + 1) * pickRandomIntegerInclusive(15, 40, random) * 60_000);
        receiptSequence += 1;
        grossMinor += priced.totalMinor;
        for (const payment of payments) {
          byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + payment.amount.amountMinor);
          if (payment.method === "cash") cashTakenMinor += payment.amount.amountMinor;
        }
        sales.push({
          id: saleId,
          receiptNumber: `IFE-${receiptSequence}`,
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
              discountAmount: naira((pricedLine?.lineDiscountMinor ?? 0) + (pricedLine?.cartDiscountShareMinor ?? 0)),
              taxAmount: naira(pricedLine?.taxMinor ?? 0),
              lineTotal: naira(pricedLine?.totalMinor ?? 0),
              refundedQuantity: 0,
            };
          }),
          cartDiscount: priced.cartDiscountMinor > 0 ? { kind: "percent", value: 1000, reason: "Loyal customer", approvedByStaffId: null } : null,
          couponCode: null,
          subtotal: naira(priced.subtotalMinor),
          discountTotal: naira(priced.discountTotalMinor),
          taxTotal: naira(priced.taxTotalMinor),
          total: naira(priced.totalMinor),
          payments,
          changeDue: naira(changeMinor),
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
            totalSpent: naira(customer.totalSpent.amountMinor + priced.totalMinor),
            purchasesCount: customer.purchasesCount + 1,
            lastPurchaseAt: createdAt.toISOString(),
          });
        }
      }

      const openingFloatMinor = 2_000_000;
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
        openingFloat: naira(openingFloatMinor),
        cashMovements: [],
        totals: {
          salesCount: salesCountForShift,
          grossSales: naira(grossMinor),
          refunds: naira(0),
          netSales: naira(grossMinor),
          byPaymentMethod: [...byMethod.entries()].map(([method, amountMinor]) => ({ method, amount: naira(amountMinor) })),
        },
        expectedCash: naira(expectedCashMinor),
        closedBy: isOpenShift ? null : cashier,
        closedAt: isOpenShift ? null : closedAt.toISOString(),
        countedCash: isOpenShift ? null : naira(expectedCashMinor + varianceMinor),
        cashVariance: isOpenShift ? null : naira(varianceMinor),
        closingNote: varianceMinor < 0 ? "Short — checked twice." : null,
      });
    }
  }
  return { shifts, sales: sales.reverse() };
}
