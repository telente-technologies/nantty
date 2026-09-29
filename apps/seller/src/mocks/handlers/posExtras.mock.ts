import { doesRoleHavePermission } from "@/config/rolePermissions.config";
import { checkStaffPinWithLockout } from "@/mocks/handlers/accessAndAuth.mock";
import { buildPrincipalActor, buildStoreMoney, readNonNegativeInteger, readPosMockSlice, readRequiredString } from "@/mocks/handlers/posMockHelpers.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockIdentifier, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithNoContent, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { ParkedSale } from "@/types/pos.type";
import { doesDiscountNeedManagerApproval } from "@/utils/posCartPricing.util";

const maximumParkedCartBytes = 60_000;

export function registerPosExtrasMockHandlers(): void {
  registerMockRoute("GET", "/seller/pos/catalog", (request) => {
    requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const locationId = request.query.get("locationId");
    if (locationId && !database.locations.some((location) => location.id === locationId)) throw new MockHttpError(404, "LOCATION_NOT_FOUND", "That location does not exist.");
    return respondWithJson(200, {
      locationId: locationId ?? database.locations.find((location) => location.isDefault)?.id ?? null,
      products: database.products.filter((product) => product.status === "active"),
      categories: database.categories,
      settings: database.settings,
      generatedAt: new Date().toISOString(),
    });
  });

  registerMockRoute("GET", "/seller/pos/parked-sales", (request) => {
    requireMockStorePrincipal(request);
    const registerId = request.query.get("registerId");
    const parked = readMockDatabase().parkedSales.filter((sale) => !registerId || sale.registerId === registerId);
    return respondWithJson(200, { data: parked, nextCursor: null });
  });

  registerMockRoute("POST", "/seller/pos/parked-sales", (request) => {
    const principal = requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const registerId = readRequiredString(body, "registerId", 64);
    const label = readRequiredString(body, "label", 80);
    const itemsCount = readNonNegativeInteger(body, "itemsCount", 100_000);
    const totalMinor = readNonNegativeInteger(body, "totalMinor");
    const cartSize = JSON.stringify(body.cart ?? null).length;
    const issues = [
      ...(registerId && readMockDatabase().registers.some((register) => register.id === registerId) ? [] : [{ path: "registerId", message: "Choose a register." }]),
      ...(label ? [] : [{ path: "label", message: "Give the parked sale a name (up to 80 characters)." }]),
      ...(itemsCount ? [] : [{ path: "itemsCount", message: "Park a cart with at least one item." }]),
      ...(totalMinor !== null ? [] : [{ path: "totalMinor", message: "The total is missing." }]),
      ...(body.cart && cartSize <= maximumParkedCartBytes ? [] : [{ path: "cart", message: "The cart is missing or too large to park." }]),
    ];
    if (issues.length > 0 || !registerId || !label || !itemsCount || totalMinor === null) return respondWithValidationFailure(issues);
    const parkedSale: ParkedSale = {
      id: createMockIdentifier("park"),
      registerId,
      label,
      customerName: typeof body.customerName === "string" ? body.customerName.slice(0, 80) : null,
      itemsCount,
      total: buildStoreMoney(totalMinor),
      cart: body.cart,
      parkedBy: buildPrincipalActor(principal),
      createdAt: new Date().toISOString(),
    };
    readMockDatabase().parkedSales.unshift(parkedSale);
    return respondWithJson(201, parkedSale);
  });

  registerMockRoute("DELETE", "/seller/pos/parked-sales/:parkedSaleId", (request) => {
    requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const parkedIndex = database.parkedSales.findIndex((sale) => sale.id === request.params.parkedSaleId);
    if (parkedIndex < 0) throw new MockHttpError(404, "PARKED_SALE_NOT_FOUND", "That parked sale was already recalled.");
    database.parkedSales.splice(parkedIndex, 1);
    return respondWithNoContent();
  });

  registerMockRoute("POST", "/seller/pos/discount-approvals", (request) => {
    const principal = requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const staffId = readRequiredString(body, "staffId", 64);
    const pin = typeof body.pin === "string" ? body.pin : "";
    const discountMinor = readNonNegativeInteger(body, "discountMinor");
    const grossMinor = readNonNegativeInteger(body, "grossMinor");
    const reason = readRequiredString(body, "reason", 200);
    const issues = [
      ...(staffId ? [] : [{ path: "staffId", message: "Choose the approving manager." }]),
      ...(/^\d{4,6}$/.test(pin) ? [] : [{ path: "pin", message: "Enter a 4–6 digit PIN." }]),
      ...(discountMinor && grossMinor && discountMinor <= grossMinor ? [] : [{ path: "discountMinor", message: "The discount must be above zero and not more than the price." }]),
      ...(reason ? [] : [{ path: "reason", message: "Give a reason for the discount." }]),
    ];
    if (issues.length > 0 || !staffId || !discountMinor || !grossMinor) return respondWithValidationFailure(issues);
    let approver;
    try {
      approver = checkStaffPinWithLockout(staffId, pin);
    } catch (error) {
      if (error instanceof MockHttpError && error.status === 401) throw new MockHttpError(403, error.code, error.message);
      throw error;
    }
    if (!doesRoleHavePermission(approver.role, "pos:approve_discount")) throw new MockHttpError(403, "APPROVER_NOT_ALLOWED", `${approver.name} cannot approve discounts. Ask a manager.`);
    const thresholdBasisPoints = readMockDatabase().settings.discountApprovalThresholdBasisPoints;
    if (!doesDiscountNeedManagerApproval(discountMinor, grossMinor, thresholdBasisPoints)) throw new MockHttpError(409, "APPROVAL_NOT_NEEDED", "This discount does not need approval.");
    const approval = { approvalId: createMockIdentifier("apr"), approvedBy: { id: approver.id, name: approver.name }, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() };
    readPosMockSlice().discountApprovals.set(approval.approvalId, { ...approval, storeId: principal.storeId, consumed: false });
    return respondWithJson(201, approval);
  });

  registerMockRoute("POST", "/seller/pos/pay-links", (request) => {
    requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const amountMinor = readNonNegativeInteger(body, "amountMinor");
    const clientSaleId = readRequiredString(body, "clientSaleId", 128);
    if (!amountMinor || !clientSaleId) return respondWithValidationFailure([{ path: "amountMinor", message: "Enter an amount above zero." }]);
    const reference = `PL${createMockIdentifier("x").slice(2, 14).toUpperCase()}`;
    const payLink = { reference, url: `https://pay.zudomart.com/l/${reference}`, amount: buildStoreMoney(amountMinor), status: "pending" as const, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), pollCount: 0, clientSaleId };
    readPosMockSlice().payLinks.set(reference, payLink);
    const { pollCount: _pollCount, clientSaleId: _clientSaleId, ...publicPayLink } = payLink;
    return respondWithJson(201, publicPayLink);
  });

  registerMockRoute("GET", "/seller/pos/pay-links/:reference", (request) => {
    requireMockStorePrincipal(request);
    const payLink = readPosMockSlice().payLinks.get(request.params.reference ?? "");
    if (!payLink) throw new MockHttpError(404, "PAY_LINK_NOT_FOUND", "That pay link does not exist.");
    payLink.pollCount += 1;
    if (payLink.status === "pending" && payLink.pollCount >= 2) Object.assign(payLink, { status: "paid" });
    const { pollCount: _pollCount, clientSaleId: _clientSaleId, ...publicPayLink } = payLink;
    return respondWithJson(200, publicPayLink);
  });
}
