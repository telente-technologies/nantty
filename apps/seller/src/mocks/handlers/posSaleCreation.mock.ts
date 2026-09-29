import { doesRoleHavePermission } from "@/config/rolePermissions.config";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockIdentifier, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import type { MockRequest, MockResponse } from "@/mocks/mockRouter.mock";
import { assertPrincipalMayUseShift, buildPrincipalActor, buildStoreMoney, findShiftOrThrow, isPaymentMethodEnabledForStore, readPosMockSlice } from "@/mocks/handlers/posMockHelpers.mock";
import type { DiscountInput, PosSale, SalePayment } from "@/types/pos.type";
import type { ProductVariant, Product } from "@/types/catalog.type";
import { calculateCartTotalsInMinorUnits, calculateDiscountAmountMinor, doesDiscountNeedManagerApproval } from "@/utils/posCartPricing.util";
import { readMinorUnitsPerMajorUnit } from "@/utils/money.util";

interface ParsedSaleLine {
  readonly product: Product;
  readonly variant: ProductVariant;
  readonly quantity: number;
  readonly discount: DiscountInput | null;
}

function parseDiscountInput(candidate: unknown): DiscountInput | null | "invalid" {
  if (candidate === null || candidate === undefined) return null;
  if (typeof candidate !== "object") return "invalid";
  const discount = candidate as Record<string, unknown>;
  const kind = discount.kind === "amount" || discount.kind === "percent" ? discount.kind : null;
  const value = typeof discount.value === "number" && Number.isSafeInteger(discount.value) && discount.value >= 0 ? discount.value : null;
  if (!kind || value === null || (kind === "percent" && value > 10_000)) return "invalid";
  return {
    kind,
    value,
    reason: typeof discount.reason === "string" ? discount.reason.slice(0, 200) : null,
    approvedByStaffId: typeof discount.approvedByStaffId === "string" ? discount.approvedByStaffId : null,
  };
}

function assertDiscountIsApprovedWhenNeeded(principalRoleCanApprove: boolean, discount: DiscountInput | null, grossMinor: number): void {
  if (!discount || principalRoleCanApprove) return;
  const thresholdBasisPoints = readMockDatabase().settings.discountApprovalThresholdBasisPoints;
  const discountMinor = calculateDiscountAmountMinor(grossMinor, discount);
  if (!doesDiscountNeedManagerApproval(discountMinor, grossMinor, thresholdBasisPoints)) return;
  const approval = [...readPosMockSlice().discountApprovals.values()].find((candidate) => candidate.approvedBy.id === discount.approvedByStaffId && new Date(candidate.expiresAt).getTime() > Date.now());
  if (!approval) throw new MockHttpError(403, "DISCOUNT_APPROVAL_REQUIRED", "This discount needs a manager's approval.");
}

function parseSaleLines(rawLines: unknown): ParsedSaleLine[] {
  if (!Array.isArray(rawLines) || rawLines.length === 0 || rawLines.length > 200) throw new MockHttpError(400, "INVALID_LINES", "Add between 1 and 200 items.");
  const products = readMockDatabase().products;
  return rawLines.map((rawLine) => {
    const line = (typeof rawLine === "object" && rawLine !== null ? rawLine : {}) as Record<string, unknown>;
    const product = products.find((candidate) => candidate.variants.some((variant) => variant.id === line.variantId));
    const variant = product?.variants.find((candidate) => candidate.id === line.variantId);
    if (!product || !variant || product.status === "archived") throw new MockHttpError(422, "ITEM_NOT_AVAILABLE", "One of the items is no longer sold.");
    const quantity = typeof line.quantity === "number" && Number.isSafeInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 9999 ? line.quantity : null;
    if (!quantity) throw new MockHttpError(400, "INVALID_QUANTITY", "Quantities must be whole numbers from 1 to 9999.");
    const discount = parseDiscountInput(line.discount);
    if (discount === "invalid") throw new MockHttpError(400, "INVALID_DISCOUNT", "A line discount is not valid.");
    return { product, variant, quantity, discount };
  });
}

function resolveCouponDiscount(couponCode: string | null, subtotalMinor: number) {
  if (!couponCode) return null;
  const promotion = readMockDatabase().promotions.find((candidate) => candidate.code?.toUpperCase() === couponCode.toUpperCase());
  if (!promotion || promotion.kind !== "coupon" || promotion.status !== "active" || !promotion.channels.includes("pos")) throw new MockHttpError(422, "COUPON_INVALID", "That coupon cannot be used in store.");
  if (promotion.usageLimit !== null && promotion.usedCount >= promotion.usageLimit) throw new MockHttpError(422, "COUPON_USED_UP", "That coupon has been used up.");
  if (promotion.minimumSpend && subtotalMinor < promotion.minimumSpend.amountMinor) throw new MockHttpError(422, "COUPON_MINIMUM_NOT_MET", "The cart is below this coupon's minimum spend.");
  return promotion;
}

export function createPosSaleFromRequest(request: MockRequest): MockResponse {
  const principal = requireMockStorePrincipal(request);
  const database = readMockDatabase();
  const settings = database.settings;
  const body = readJsonObjectBody(request);
  const clientSaleId = typeof body.clientSaleId === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(body.clientSaleId) ? body.clientSaleId : null;
  if (!clientSaleId) return respondWithValidationFailure([{ path: "clientSaleId", message: "A client sale id is required." }]);
  const existingSale = database.sales.find((sale) => sale.clientSaleId === clientSaleId);
  if (existingSale) return respondWithJson(200, existingSale);

  const shift = findShiftOrThrow(typeof body.shiftId === "string" ? body.shiftId : "");
  assertPrincipalMayUseShift(principal, shift);
  const offlineCreatedAt = typeof body.offlineCreatedAt === "string" && !Number.isNaN(Date.parse(body.offlineCreatedAt)) ? body.offlineCreatedAt : null;
  const wasOpenWhenRungUp = shift.status === "open" || (offlineCreatedAt !== null && shift.closedAt !== null && shift.closedAt >= offlineCreatedAt);
  if (!wasOpenWhenRungUp) throw new MockHttpError(409, "SHIFT_CLOSED", "This shift is closed. Open a new shift to keep selling.");
  if (body.registerId !== shift.registerId || body.locationId !== shift.locationId) throw new MockHttpError(422, "REGISTER_MISMATCH", "The register or location does not match the shift.");

  const lines = parseSaleLines(body.lines);
  const cartDiscount = parseDiscountInput(body.cartDiscount);
  if (cartDiscount === "invalid") return respondWithValidationFailure([{ path: "cartDiscount", message: "The cart discount is not valid." }]);
  const principalCanApprove = doesRoleHavePermission(principal.role, "pos:approve_discount");
  for (const line of lines) assertDiscountIsApprovedWhenNeeded(principalCanApprove, line.discount, line.variant.price.amountMinor * line.quantity);
  const grossMinor = lines.reduce((sum, line) => sum + line.variant.price.amountMinor * line.quantity, 0);
  assertDiscountIsApprovedWhenNeeded(principalCanApprove, cartDiscount, grossMinor);

  const customerIndex = typeof body.customerId === "string" ? database.customers.findIndex((customer) => customer.id === body.customerId) : -1;
  const customer = customerIndex >= 0 ? database.customers[customerIndex] : undefined;
  if (body.customerId && !customer) throw new MockHttpError(404, "CUSTOMER_NOT_FOUND", "That customer does not exist.");
  const loyaltyPointsToRedeem = typeof body.loyaltyPointsToRedeem === "number" && Number.isSafeInteger(body.loyaltyPointsToRedeem) && body.loyaltyPointsToRedeem > 0 ? body.loyaltyPointsToRedeem : 0;
  if (loyaltyPointsToRedeem > 0 && (!customer || !settings.loyalty.enabled || loyaltyPointsToRedeem > customer.loyaltyPoints || loyaltyPointsToRedeem < settings.loyalty.minimumPointsToRedeem)) {
    throw new MockHttpError(422, "LOYALTY_REDEMPTION_INVALID", "Those loyalty points cannot be redeemed.");
  }
  const couponCode = typeof body.couponCode === "string" && body.couponCode.trim() ? body.couponCode.trim().slice(0, 40) : null;
  const coupon = resolveCouponDiscount(couponCode, grossMinor);

  const priced = calculateCartTotalsInMinorUnits({
    currency: settings.currency,
    lines: lines.map((line) => ({ unitPriceMinor: line.variant.price.amountMinor, quantity: line.quantity, taxable: line.product.taxable, categoryId: line.product.categoryId, discount: line.discount })),
    cartDiscount,
    couponDiscount: coupon?.discount ?? null,
    loyaltyRedemptionMinor: loyaltyPointsToRedeem * settings.loyalty.redeemValuePerPoint.amountMinor,
    taxes: settings.taxes,
    pricesIncludeTax: settings.pricesIncludeTax,
  });

  if (!offlineCreatedAt) {
    for (const line of lines) {
      const stockLevel = line.variant.stock.find((level) => level.locationId === shift.locationId);
      const availableQuantity = stockLevel ? stockLevel.onHand - stockLevel.reserved : 0;
      if (line.product.trackInventory && availableQuantity < line.quantity) throw new MockHttpError(409, "INSUFFICIENT_STOCK", `Only ${Math.max(availableQuantity, 0)} of ${line.product.name} (${line.variant.title}) left here.`);
    }
  }

  const rawPayments = Array.isArray(body.payments) ? body.payments : [];
  if (rawPayments.length === 0 || rawPayments.length > 10) return respondWithValidationFailure([{ path: "payments", message: "Add at least one payment." }]);
  let changeMinor = 0;
  const payments: SalePayment[] = rawPayments.map((rawPayment, index) => {
    const payment = (typeof rawPayment === "object" && rawPayment !== null ? rawPayment : {}) as Record<string, unknown>;
    if (!isPaymentMethodEnabledForStore(payment.method)) throw new MockHttpError(422, "PAYMENT_METHOD_DISABLED", "One of the payment methods is switched off for this store.");
    const amountMinor = typeof payment.amountMinor === "number" && Number.isSafeInteger(payment.amountMinor) && payment.amountMinor > 0 ? payment.amountMinor : null;
    if (!amountMinor) throw new MockHttpError(400, "INVALID_PAYMENT", "Payment amounts must be above zero.");
    const tenderedMinor = payment.method === "cash" && typeof payment.tenderedMinor === "number" && Number.isSafeInteger(payment.tenderedMinor) ? payment.tenderedMinor : null;
    if (tenderedMinor !== null && tenderedMinor < amountMinor) throw new MockHttpError(400, "INVALID_TENDER", "Cash tendered cannot be less than the cash amount.");
    const reference = typeof payment.reference === "string" ? payment.reference.trim().slice(0, 80) || null : null;
    if (payment.method === "pay_link" || payment.method === "zudomart_wallet") {
      const payLink = reference ? readPosMockSlice().payLinks.get(reference) : undefined;
      if (!payLink || payLink.status !== "paid" || payLink.amount.amountMinor !== amountMinor) throw new MockHttpError(402, "PAY_LINK_NOT_PAID", "The pay link has not been paid yet.");
    }
    if (tenderedMinor !== null) changeMinor += tenderedMinor - amountMinor;
    return { id: `${clientSaleId}_pay_${index + 1}`, method: payment.method, amount: buildStoreMoney(amountMinor), tendered: tenderedMinor === null ? null : buildStoreMoney(tenderedMinor), change: tenderedMinor === null ? null : buildStoreMoney(tenderedMinor - amountMinor), reference, status: "captured" };
  });
  const paidMinor = payments.reduce((sum, payment) => sum + payment.amount.amountMinor, 0);
  if (paidMinor !== priced.totalMinor && !offlineCreatedAt) throw new MockHttpError(422, "PAYMENT_TOTAL_MISMATCH", "Payments do not add up to the sale total. Prices may have changed; refresh the register.");

  const lastReceiptNumber = database.sales.reduce((highest, sale) => Math.max(highest, Number(sale.receiptNumber.replace(/\D/g, "")) || 0), 1000);
  const minorPerMajor = readMinorUnitsPerMajorUnit(settings.currency);
  const loyaltyPointsEarned = customer && settings.loyalty.enabled ? Math.floor((priced.totalMinor / minorPerMajor) * settings.loyalty.pointsEarnedPerMajorUnit) : 0;
  const sale: PosSale = {
    id: createMockIdentifier("sale"),
    receiptNumber: `IFE-${lastReceiptNumber + 1}`,
    locationId: shift.locationId,
    registerId: shift.registerId,
    shiftId: shift.id,
    cashier: buildPrincipalActor(principal),
    customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
    lines: lines.map((line, index) => {
      const pricedLine = priced.lines[index];
      return {
        id: `${clientSaleId}_line_${index + 1}`,
        productId: line.product.id,
        variantId: line.variant.id,
        name: line.product.name,
        variantTitle: line.variant.title,
        sku: line.variant.sku,
        quantity: line.quantity,
        unitPrice: line.variant.price,
        discount: line.discount,
        discountAmount: buildStoreMoney((pricedLine?.lineDiscountMinor ?? 0) + (pricedLine?.cartDiscountShareMinor ?? 0)),
        taxAmount: buildStoreMoney(pricedLine?.taxMinor ?? 0),
        lineTotal: buildStoreMoney(pricedLine?.totalMinor ?? 0),
        refundedQuantity: 0,
      };
    }),
    cartDiscount,
    couponCode: coupon?.code ?? null,
    subtotal: buildStoreMoney(priced.subtotalMinor),
    discountTotal: buildStoreMoney(priced.discountTotalMinor),
    taxTotal: buildStoreMoney(priced.taxTotalMinor),
    total: buildStoreMoney(priced.totalMinor),
    payments,
    changeDue: buildStoreMoney(changeMinor),
    loyaltyPointsEarned,
    loyaltyPointsRedeemed: loyaltyPointsToRedeem,
    status: "completed",
    refundIds: [],
    createdAt: new Date().toISOString(),
    offlineCreatedAt,
    clientSaleId,
  };

  for (const line of lines) {
    const productIndex = database.products.findIndex((product) => product.id === line.product.id);
    const product = database.products[productIndex];
    if (!product || !product.trackInventory) continue;
    database.products[productIndex] = {
      ...product,
      variants: product.variants.map((variant) => variant.id !== line.variant.id ? variant : { ...variant, stock: variant.stock.map((level) => (level.locationId === shift.locationId ? { ...level, onHand: level.onHand - line.quantity } : level)) }),
    };
  }
  if (customer) {
    database.customers[customerIndex] = { ...customer, loyaltyPoints: customer.loyaltyPoints - loyaltyPointsToRedeem + loyaltyPointsEarned, totalSpent: buildStoreMoney(customer.totalSpent.amountMinor + priced.totalMinor), purchasesCount: customer.purchasesCount + 1, lastPurchaseAt: sale.createdAt };
  }
  if (coupon) Object.assign(coupon, { usedCount: coupon.usedCount + 1 });
  database.sales.unshift(sale);
  return respondWithJson(201, sale);
}
