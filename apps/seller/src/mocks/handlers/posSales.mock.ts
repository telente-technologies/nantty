import { appendMockAuditLogEntry, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { runOnceForIdempotencyKey } from "@/mocks/mockIdempotency.mock";
import { MockHttpError, createMockIdentifier, matchesSearchText, paginateMockList, readDateRangeFromQuery, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockPrincipal } from "@/mocks/mockRouter.mock";
import { buildPrincipalActor, buildStoreMoney, canPrincipalManageAllShifts, isPaymentMethodEnabledForStore } from "@/mocks/handlers/posMockHelpers.mock";
import { createPosSaleFromRequest } from "@/mocks/handlers/posSaleCreation.mock";
import type { PosSale, SaleRefund } from "@/types/pos.type";

function findVisibleSaleOrThrow(principal: MockPrincipal, saleId: string): PosSale {
  const sale = readMockDatabase().sales.find((candidate) => candidate.id === saleId);
  if (!sale) throw new MockHttpError(404, "SALE_NOT_FOUND", "That sale does not exist.");
  if (!canPrincipalManageAllShifts(principal) && sale.cashier.id !== principal.staffId) throw new MockHttpError(404, "SALE_NOT_FOUND", "That sale does not exist.");
  return sale;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phonePattern = /^\+?[0-9][0-9\s-]{6,18}$/;

export function registerPosSaleMockHandlers(): void {
  registerMockRoute("GET", "/seller/pos/sales", (request) => {
    const principal = requireMockStorePrincipal(request);
    const { query } = request;
    const { from, to } = readDateRangeFromQuery(query, 30);
    const sales = readMockDatabase().sales.filter((sale) => {
      const createdAt = new Date(sale.createdAt);
      return createdAt >= from && createdAt <= to
        && (canPrincipalManageAllShifts(principal) || sale.cashier.id === principal.staffId)
        && (!query.get("locationId") || sale.locationId === query.get("locationId"))
        && (!query.get("registerId") || sale.registerId === query.get("registerId"))
        && (!query.get("cashierId") || sale.cashier.id === query.get("cashierId"))
        && (!query.get("status") || sale.status === query.get("status"))
        && (!query.get("paymentMethod") || sale.payments.some((payment) => payment.method === query.get("paymentMethod")))
        && matchesSearchText(query.get("q"), sale.receiptNumber, sale.customer?.name, sale.customer?.phone);
    });
    return respondWithJson(200, paginateMockList(sales, query, 25));
  });

  registerMockRoute("GET", "/seller/pos/sales/:saleId", (request) => respondWithJson(200, findVisibleSaleOrThrow(requireMockStorePrincipal(request), request.params.saleId ?? "")));

  registerMockRoute("POST", "/seller/pos/sales", (request) => runOnceForIdempotencyKey(request, () => createPosSaleFromRequest(request)));

  registerMockRoute("GET", "/seller/pos/sales/:saleId/refunds", (request) => {
    const sale = findVisibleSaleOrThrow(requireMockStorePrincipal(request), request.params.saleId ?? "");
    return respondWithJson(200, { data: readMockDatabase().refunds.filter((refund) => refund.saleId === sale.id), nextCursor: null });
  });

  registerMockRoute("POST", "/seller/pos/sales/:saleId/refunds", (request) =>
    runOnceForIdempotencyKey(request, () => {
      const principal = requireMockStorePrincipal(request);
      const database = readMockDatabase();
      const sale = findVisibleSaleOrThrow(principal, request.params.saleId ?? "");
      if (sale.status === "refunded" || sale.status === "voided") throw new MockHttpError(409, "ALREADY_REFUNDED", "This sale has nothing left to refund.");
      const body = readJsonObjectBody(request);
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      const kind = body.kind === "exchange" ? "exchange" : "refund";
      const rawLines = Array.isArray(body.lines) ? body.lines : [];
      const issues = [
        ...(reason.length >= 3 && reason.length <= 300 ? [] : [{ path: "reason", message: "Give a reason (3–300 characters)." }]),
        ...(isPaymentMethodEnabledForStore(body.method) ? [] : [{ path: "method", message: "Choose an enabled refund method." }]),
        ...(rawLines.length > 0 ? [] : [{ path: "lines", message: "Choose at least one item to refund." }]),
      ];
      if (issues.length > 0 || !isPaymentMethodEnabledForStore(body.method)) return respondWithValidationFailure(issues);
      const refundLines = rawLines.map((rawLine) => {
        const line = (typeof rawLine === "object" && rawLine !== null ? rawLine : {}) as Record<string, unknown>;
        const saleLine = sale.lines.find((candidate) => candidate.id === line.saleLineId);
        const quantity = typeof line.quantity === "number" && Number.isSafeInteger(line.quantity) ? line.quantity : 0;
        if (!saleLine || quantity < 1 || quantity > saleLine.quantity - saleLine.refundedQuantity) throw new MockHttpError(422, "REFUND_QUANTITY_INVALID", "A refund quantity is more than what is left on the receipt.");
        const amountMinor = Math.round((saleLine.lineTotal.amountMinor * quantity) / saleLine.quantity);
        return { saleLineId: saleLine.id, quantity, restock: line.restock === true, amount: buildStoreMoney(amountMinor), variantId: saleLine.variantId };
      });
      const refundTotalMinor = refundLines.reduce((sum, line) => sum + line.amount.amountMinor, 0);
      const refund: SaleRefund = {
        id: createMockIdentifier("rfd"),
        saleId: sale.id,
        receiptNumber: sale.receiptNumber,
        kind,
        lines: refundLines.map(({ saleLineId, quantity, restock, amount }) => ({ saleLineId, quantity, restock, amount })),
        amount: buildStoreMoney(refundTotalMinor),
        method: body.method,
        reason,
        exchangeSaleId: null,
        createdBy: buildPrincipalActor(principal),
        createdAt: new Date().toISOString(),
      };
      const updatedLines = sale.lines.map((line) => {
        const refundedNow = refundLines.filter((refundLine) => refundLine.saleLineId === line.id).reduce((sum, refundLine) => sum + refundLine.quantity, 0);
        return { ...line, refundedQuantity: line.refundedQuantity + refundedNow };
      });
      const isFullyRefunded = updatedLines.every((line) => line.refundedQuantity >= line.quantity);
      const saleIndex = database.sales.findIndex((candidate) => candidate.id === sale.id);
      database.sales[saleIndex] = { ...sale, lines: updatedLines, status: isFullyRefunded ? "refunded" : "partially_refunded", refundIds: [...sale.refundIds, refund.id] };
      database.refunds.unshift(refund);
      for (const refundLine of refundLines.filter((line) => line.restock)) {
        const productIndex = database.products.findIndex((product) => product.variants.some((variant) => variant.id === refundLine.variantId));
        const product = database.products[productIndex];
        if (!product) continue;
        database.products[productIndex] = { ...product, variants: product.variants.map((variant) => variant.id !== refundLine.variantId ? variant : { ...variant, stock: variant.stock.map((level) => (level.locationId === sale.locationId ? { ...level, onHand: level.onHand + refundLine.quantity } : level)) }) };
      }
      const customerIndex = sale.customer ? database.customers.findIndex((customer) => customer.id === sale.customer?.id) : -1;
      const customer = database.customers[customerIndex];
      if (customer) database.customers[customerIndex] = { ...customer, totalSpent: buildStoreMoney(Math.max(0, customer.totalSpent.amountMinor - refundTotalMinor)) };
      appendMockAuditLogEntry({ actor: { id: principal.staffId ?? principal.userId, name: principal.actorName, role: principal.role ?? "manager" }, action: "pos.refund_issued", targetType: "sale", targetId: sale.id, summary: `Refunded ${refundLines.reduce((sum, line) => sum + line.quantity, 0)} item(s) on ${sale.receiptNumber}` });
      return respondWithJson(201, refund);
    }),
  );

  registerMockRoute("POST", "/seller/pos/sales/:saleId/share", (request) => {
    const sale = findVisibleSaleOrThrow(requireMockStorePrincipal(request), request.params.saleId ?? "");
    const body = readJsonObjectBody(request);
    const channel = body.channel === "email" || body.channel === "sms" || body.channel === "whatsapp" ? body.channel : null;
    const destination = typeof body.destination === "string" ? body.destination.trim() : "";
    if (!channel) return respondWithValidationFailure([{ path: "channel", message: "Choose email, SMS or WhatsApp." }]);
    if (channel === "email" && !emailPattern.test(destination)) return respondWithValidationFailure([{ path: "destination", message: "Enter a valid email address." }]);
    if (channel === "sms" && !phonePattern.test(destination)) return respondWithValidationFailure([{ path: "destination", message: "Enter a valid phone number." }]);
    const url = `https://zudomart.com/r/${sale.id.replace(/^sale_/, "")}`;
    const storeName = readMockDatabase().settings.name;
    return respondWithJson(200, { url, channel, sentTo: channel === "whatsapp" ? null : destination, message: `Thanks for shopping at ${storeName}! Your receipt ${sale.receiptNumber}: ${url}` });
  });
}
