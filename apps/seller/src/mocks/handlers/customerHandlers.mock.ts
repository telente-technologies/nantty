import { buildMockAuditActor } from "@/mocks/handlers/orderHandlers.mock";
import { appendMockAuditLogEntry, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { runOnceForIdempotencyKey } from "@/mocks/mockIdempotency.mock";
import {
  MockHttpError,
  createMockIdentifier,
  matchesSearchText,
  paginateMockList,
  readJsonObjectBody,
  requireMockStorePrincipal,
  respondWithCsv,
  respondWithJson,
  respondWithValidationFailure,
} from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { Customer, CustomerPurchase } from "@/types/customer.type";
import { validateCustomerProfileInput, type CustomerProfileInput } from "@/utils/customerValidation.util";
import { convertRowsToCsvText } from "@/utils/csvFile.util";
import { convertMinorUnitsToMajorInputText } from "@/utils/money.util";

function findCustomerIndexOrThrow(customerId: string): number {
  const customerIndex = readMockDatabase().customers.findIndex((customer) => customer.id === customerId);
  if (customerIndex < 0) throw new MockHttpError(404, "CUSTOMER_NOT_FOUND", "That customer does not exist in your store.");
  return customerIndex;
}

function normalisePhoneForComparison(phone: string | null | undefined): string {
  return (phone ?? "").replace(/[^\d]/g, "").replace(/^0/, "234");
}

function findDuplicateCustomer(input: CustomerProfileInput, ignoredCustomerId: string | null): Customer | undefined {
  const phoneKey = normalisePhoneForComparison(input.phone);
  const emailKey = (input.email ?? "").trim().toLowerCase();
  return readMockDatabase().customers.find(
    (customer) =>
      customer.id !== ignoredCustomerId &&
      ((phoneKey !== "" && normalisePhoneForComparison(customer.phone) === phoneKey) || (emailKey !== "" && customer.email?.toLowerCase() === emailKey)),
  );
}

function readCustomerProfileInput(request: MockRequest): CustomerProfileInput {
  const body = readJsonObjectBody(request);
  return {
    name: typeof body.name === "string" ? body.name.trim() : "",
    phone: typeof body.phone === "string" && body.phone.trim() !== "" ? body.phone.trim() : null,
    email: typeof body.email === "string" && body.email.trim() !== "" ? body.email.trim().toLowerCase() : null,
    tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim().toLowerCase()) : [],
    marketingOptIn: body.marketingOptIn === true,
  };
}

function filterAndSortCustomers(request: MockRequest): Customer[] {
  const tag = request.query.get("tag");
  const sort = request.query.get("sort") ?? "recent";
  const customers = readMockDatabase().customers.filter(
    (customer) => (!tag || customer.tags.includes(tag)) && matchesSearchText(request.query.get("q"), customer.name, customer.phone, customer.email, customer.zudomartUsername),
  );
  return [...customers].sort((first, second) => {
    if (sort === "spend") return second.totalSpent.amountMinor - first.totalSpent.amountMinor;
    if (sort === "name") return first.name.localeCompare(second.name);
    return (second.lastPurchaseAt ?? second.createdAt).localeCompare(first.lastPurchaseAt ?? first.createdAt);
  });
}

function listCustomerPurchases(customer: Customer): CustomerPurchase[] {
  const database = readMockDatabase();
  const inStorePurchases: CustomerPurchase[] = database.sales
    .filter((sale) => sale.customer?.id === customer.id)
    .map((sale) => ({ kind: "pos_sale", id: sale.id, reference: sale.receiptNumber, total: sale.total, itemsCount: sale.lines.reduce((sum, line) => sum + line.quantity, 0), createdAt: sale.createdAt }));
  const onlinePurchases: CustomerPurchase[] = customer.zudomartUsername
    ? database.onlineOrders
        .filter((order) => order.buyer.username === customer.zudomartUsername)
        .map((order) => ({ kind: "online_order", id: order.id, reference: order.orderNumber, total: order.total, itemsCount: order.lines.reduce((sum, line) => sum + line.quantity, 0), createdAt: order.createdAt }))
    : [];
  return [...inStorePurchases, ...onlinePurchases].sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

function registerCustomerDetailHandlers(): void {
  registerMockRoute("GET", "/seller/customers/:customerId", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, readMockDatabase().customers[findCustomerIndexOrThrow(request.params.customerId ?? "")]);
  });

  registerMockRoute("PATCH", "/seller/customers/:customerId", (request) => {
    requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const customerIndex = findCustomerIndexOrThrow(request.params.customerId ?? "");
    const customer = database.customers[customerIndex] as Customer;
    const input = readCustomerProfileInput(request);
    const issues = validateCustomerProfileInput(input);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    if (findDuplicateCustomer(input, customer.id)) throw new MockHttpError(409, "CUSTOMER_EXISTS", "Another customer already uses that phone number or email.");
    const updated: Customer = { ...customer, ...input };
    database.customers[customerIndex] = updated;
    return respondWithJson(200, updated);
  });

  registerMockRoute("GET", "/seller/customers/:customerId/purchases", (request) => {
    requireMockStorePrincipal(request);
    const customer = readMockDatabase().customers[findCustomerIndexOrThrow(request.params.customerId ?? "")] as Customer;
    return respondWithJson(200, paginateMockList(listCustomerPurchases(customer), request.query, 20));
  });

  registerMockRoute("POST", "/seller/customers/:customerId/notes", (request) => {
    const principal = requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const customerIndex = findCustomerIndexOrThrow(request.params.customerId ?? "");
    const customer = database.customers[customerIndex] as Customer;
    const noteBody = String(readJsonObjectBody(request).body ?? "").trim();
    if (noteBody.length < 2 || noteBody.length > 1000) return respondWithValidationFailure([{ path: "body", message: "Write a note (2–1,000 characters)." }]);
    const note = { id: createMockIdentifier("note"), body: noteBody, author: { id: principal.staffId ?? principal.userId, name: principal.actorName }, createdAt: new Date().toISOString() };
    const updated: Customer = { ...customer, notes: [note, ...customer.notes] };
    database.customers[customerIndex] = updated;
    return respondWithJson(201, updated);
  });

  registerMockRoute("POST", "/seller/customers/:customerId/loyalty-adjustments", (request) =>
    runOnceForIdempotencyKey(request, () => {
      const principal = requireMockStorePrincipal(request);
      const database = readMockDatabase();
      const customerIndex = findCustomerIndexOrThrow(request.params.customerId ?? "");
      const customer = database.customers[customerIndex] as Customer;
      const body = readJsonObjectBody(request);
      const pointsDelta = body.pointsDelta;
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      const issues: { path: string; message: string }[] = [];
      if (typeof pointsDelta !== "number" || !Number.isSafeInteger(pointsDelta) || pointsDelta === 0 || Math.abs(pointsDelta) > 1_000_000) issues.push({ path: "pointsDelta", message: "Enter a whole number of points other than zero." });
      if (reason.length < 3 || reason.length > 200) issues.push({ path: "reason", message: "Give a reason (3–200 characters)." });
      if (issues.length > 0) return respondWithValidationFailure(issues);
      const nextPoints = customer.loyaltyPoints + (pointsDelta as number);
      if (nextPoints < 0) throw new MockHttpError(422, "POINTS_BELOW_ZERO", `This customer only has ${customer.loyaltyPoints} points.`);
      const updated: Customer = { ...customer, loyaltyPoints: nextPoints };
      database.customers[customerIndex] = updated;
      appendMockAuditLogEntry({ actor: buildMockAuditActor(principal), action: "customer.loyalty_adjusted", targetType: "customer", targetId: customer.id, summary: `${(pointsDelta as number) > 0 ? "Added" : "Removed"} ${Math.abs(pointsDelta as number)} points for ${customer.name}: ${reason}` });
      return respondWithJson(200, updated);
    }),
  );
}

export function registerCustomerMockHandlers(): void {
  registerMockRoute("GET", "/seller/customers", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, paginateMockList(filterAndSortCustomers(request), request.query));
  });

  registerMockRoute("POST", "/seller/customers", (request) => {
    requireMockStorePrincipal(request);
    const input = readCustomerProfileInput(request);
    const issues = validateCustomerProfileInput(input);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const duplicate = findDuplicateCustomer(input, null);
    if (duplicate) return respondWithJson(409, { message: `${duplicate.name} already uses that phone number or email.`, code: "CUSTOMER_EXISTS", customer: duplicate });
    const customer: Customer = {
      id: createMockIdentifier("cus"),
      ...input,
      zudomartUsername: null,
      notes: [],
      loyaltyPoints: 0,
      totalSpent: { amountMinor: 0, currency: readMockDatabase().settings.currency },
      purchasesCount: 0,
      lastPurchaseAt: null,
      createdAt: new Date().toISOString(),
    };
    readMockDatabase().customers.unshift(customer);
    return respondWithJson(201, customer);
  });

  registerMockRoute("GET", "/seller/customers/export", (request) => {
    requireMockStorePrincipal(request);
    const rows = filterAndSortCustomers(request).map((customer) => [
      customer.name, customer.phone, customer.email, customer.zudomartUsername, customer.tags.join(" "), customer.loyaltyPoints,
      convertMinorUnitsToMajorInputText(customer.totalSpent.amountMinor, customer.totalSpent.currency), customer.totalSpent.currency, customer.purchasesCount, customer.lastPurchaseAt, customer.marketingOptIn ? "yes" : "no",
    ]);
    const csvText = convertRowsToCsvText(["Name", "Phone", "Email", "Zudomart username", "Tags", "Loyalty points", "Total spent", "Currency", "Purchases", "Last purchase", "Marketing opt-in"], rows);
    return respondWithCsv("customers.csv", csvText);
  });

  registerCustomerDetailHandlers();
}
