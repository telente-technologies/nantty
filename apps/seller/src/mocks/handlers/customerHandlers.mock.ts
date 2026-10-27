import { listCustomerPurchasesFromAppOrders, listCustomersWithPurchaseStats, addPurchaseStatsToCustomer } from "@/mocks/handlers/customerInsights.mock";
import { findSegmentRulesOrThrow, registerCustomerSummaryAndSegmentMockHandlers } from "@/mocks/handlers/customerSegments.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
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
import type { Customer } from "@/types/customer.type";
import { deriveCustomerTypeFromPurchases, doesCustomerMatchEverySegmentRule } from "@/utils/customerSegmentRules.util";
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

const customerSortReaders: Record<string, (customer: Customer) => string | number> = {
  recent: (customer) => customer.lastPurchaseAt ?? customer.createdAt,
  spend: (customer) => customer.totalSpent.amountMinor,
  purchases: (customer) => customer.purchasesCount,
  aov: (customer) => customer.averageOrderValue?.amountMinor ?? 0,
  first: (customer) => customer.firstPurchaseAt ?? "",
  name: (customer) => customer.name.toLowerCase(),
};

function filterAndSortCustomers(request: MockRequest): Customer[] {
  const tag = request.query.get("tag");
  const type = request.query.get("type");
  const segmentId = request.query.get("segmentId");
  const sortKey = request.query.get("sort") ?? "recent";
  const readSortValue = customerSortReaders[sortKey] ?? ((customer: Customer) => customer.lastPurchaseAt ?? customer.createdAt);
  const direction = request.query.get("direction") === "asc" || (!request.query.get("direction") && sortKey === "name") ? 1 : -1;
  const segmentRules = segmentId ? findSegmentRulesOrThrow(segmentId) : null;
  const customers = listCustomersWithPurchaseStats().filter(
    (customer) =>
      (!tag || customer.tags.includes(tag)) &&
      (!type || type === "all" || deriveCustomerTypeFromPurchases(customer) === type) &&
      (!segmentRules || doesCustomerMatchEverySegmentRule(customer, segmentRules)) &&
      matchesSearchText(request.query.get("q"), customer.name, customer.phone, customer.email, customer.nanttyUsername, customer.city),
  );
  return [...customers].sort((first, second) => {
    const left = readSortValue(first);
    const right = readSortValue(second);
    return (typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right))) * direction;
  });
}

function registerCustomerDetailHandlers(): void {
  registerMockRoute("GET", "/seller/customers/:customerId", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, addPurchaseStatsToCustomer(readMockDatabase().customers[findCustomerIndexOrThrow(request.params.customerId ?? "")] as Customer));
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
    return respondWithJson(200, addPurchaseStatsToCustomer(updated));
  });

  registerMockRoute("GET", "/seller/customers/:customerId/purchases", (request) => {
    requireMockStorePrincipal(request);
    const customer = readMockDatabase().customers[findCustomerIndexOrThrow(request.params.customerId ?? "")] as Customer;
    return respondWithJson(200, paginateMockList(listCustomerPurchasesFromAppOrders(addPurchaseStatsToCustomer(customer)), request.query, 20));
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
    return respondWithJson(201, addPurchaseStatsToCustomer(updated));
  });

}

export function registerCustomerMockHandlers(): void {
  registerCustomerSummaryAndSegmentMockHandlers();
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
      nanttyUsername: null,
      city: null,
      notes: [],
      storeCreditBalance: { amountMinor: 0, currency: readMockDatabase().settings.currency },
      storeCreditExpiresAt: null,
      totalSpent: { amountMinor: 0, currency: readMockDatabase().settings.currency },
      averageOrderValue: null,
      purchasesCount: 0,
      firstPurchaseAt: null,
      lastPurchaseAt: null,
      createdAt: new Date().toISOString(),
    };
    listCustomersWithPurchaseStats();
    readMockDatabase().customers.unshift(customer);
    return respondWithJson(201, customer);
  });

  registerMockRoute("GET", "/seller/customers/export", (request) => {
    requireMockStorePrincipal(request);
    const rows = filterAndSortCustomers(request).map((customer) => [
      customer.name, customer.phone, customer.email, customer.nanttyUsername, customer.city, customer.tags.join(" "),
      convertMinorUnitsToMajorInputText(customer.totalSpent.amountMinor, customer.totalSpent.currency), customer.averageOrderValue ? convertMinorUnitsToMajorInputText(customer.averageOrderValue.amountMinor, customer.averageOrderValue.currency) : "", customer.totalSpent.currency, customer.purchasesCount, customer.firstPurchaseAt, customer.lastPurchaseAt, customer.marketingOptIn ? "yes" : "no",
    ]);
    const csvText = convertRowsToCsvText(["Name", "Phone", "Email", "Nantty username", "City", "Tags", "Total spent", "Average order value", "Currency", "Orders", "First order", "Last order", "Marketing opt-in"], rows);
    return respondWithCsv("customers.csv", csvText);
  });

  registerCustomerDetailHandlers();
}
