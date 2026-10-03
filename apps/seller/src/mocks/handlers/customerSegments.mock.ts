import { readMockStorePlanFeatureDenial } from "@/mocks/handlers/growthPlanGate.mock";
import { buildCustomersSummary, listCustomersWithPurchaseStats } from "@/mocks/handlers/customerInsights.mock";
import { readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { createMockIdentifier, MockHttpError, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithNoContent, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { Customer, CustomerSegment, CustomerSegmentInput, CustomerSegmentRule } from "@/types/customer.type";
import { doesCustomerMatchEverySegmentRule, validateCustomerSegmentInput } from "@/utils/customerSegmentRules.util";

interface StoredCustomerSegment {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly rules: CustomerSegmentRule[];
  readonly createdAt: string;
}

function buildBuiltInSegmentDefinitions(vipSpendMinor: number): StoredCustomerSegment[] {
  const createdAt = "2026-01-01T00:00:00.000Z";
  return [
    { id: "seg_new", name: "New customers", description: "One order so far, placed in the last 30 days.", rules: [{ field: "purchases_count", operator: "equals", value: 1 }, { field: "days_since_first_purchase", operator: "at_most", value: 30 }], createdAt },
    { id: "seg_returning", name: "Returning customers", description: "Ordered two or more times.", rules: [{ field: "purchases_count", operator: "at_least", value: 2 }], createdAt },
    { id: "seg_vip", name: "VIP", description: "Your biggest spenders.", rules: [{ field: "total_spent", operator: "at_least", value: vipSpendMinor }], createdAt },
    { id: "seg_at_risk", name: "At risk", description: "Used to order often but nothing in 60 days.", rules: [{ field: "purchases_count", operator: "at_least", value: 2 }, { field: "days_since_last_purchase", operator: "at_least", value: 60 }], createdAt },
  ];
}

function readCustomSegments(): StoredCustomerSegment[] {
  return readStoreScopedMockSlice("customerSegments", () => ({
    segments: [{ id: "seg_custom_lagos_optin", name: "Lagos buyers who accept offers", description: "For weekend promo broadcasts.", rules: [{ field: "city", operator: "equals", value: "Lekki" }, { field: "marketing_opt_in", operator: "equals", value: true }], createdAt: new Date(Date.now() - 12 * 86_400_000).toISOString() }] as StoredCustomerSegment[],
  })).segments;
}

function computeVipSpendThresholdMinor(customers: readonly Customer[]): number {
  const spends = customers.map((customer) => customer.totalSpent.amountMinor).filter((amount) => amount > 0).sort((first, second) => second - first);
  return spends[Math.max(0, Math.floor(spends.length * 0.15) - 1)] ?? 0;
}

function presentSegment(segment: StoredCustomerSegment, kind: CustomerSegment["kind"], customers: readonly Customer[]): CustomerSegment {
  const members = customers.filter((customer) => doesCustomerMatchEverySegmentRule(customer, segment.rules));
  const currency = readMockDatabase().settings.currency;
  const spentMinor = members.reduce((sum, customer) => sum + customer.totalSpent.amountMinor, 0);
  const ordersCount = members.reduce((sum, customer) => sum + customer.purchasesCount, 0);
  return { ...segment, kind, customerCount: members.length, totalSpent: { amountMinor: spentMinor, currency }, averageOrderValue: ordersCount > 0 ? { amountMinor: Math.round(spentMinor / ordersCount), currency } : null };
}

export function listEveryCustomerSegment(): CustomerSegment[] {
  const customers = listCustomersWithPurchaseStats();
  return [
    ...buildBuiltInSegmentDefinitions(computeVipSpendThresholdMinor(customers)).map((segment) => presentSegment(segment, "built_in", customers)),
    ...readCustomSegments().map((segment) => presentSegment(segment, "custom", customers)),
  ];
}

export function findSegmentRulesOrThrow(segmentId: string): CustomerSegmentRule[] {
  const segment = listEveryCustomerSegment().find((candidate) => candidate.id === segmentId);
  if (!segment) throw new MockHttpError(404, "SEGMENT_NOT_FOUND", "That segment does not exist.");
  return segment.rules;
}

function readSegmentInput(request: MockRequest): CustomerSegmentInput {
  const body = readJsonObjectBody(request);
  const rules = Array.isArray(body.rules) ? (body.rules as CustomerSegmentRule[]).filter((rule) => typeof rule === "object" && rule !== null) : [];
  return { name: typeof body.name === "string" ? body.name.trim() : "", description: typeof body.description === "string" ? body.description.trim() : "", rules: rules.map((rule) => ({ field: rule.field, operator: rule.operator ?? "equals", value: typeof rule.value === "string" ? rule.value.trim().toLowerCase() : rule.value })) };
}

function requireSegmentsPlan(request: MockRequest) {
  const principal = requireMockStorePrincipal(request);
  const denial = readMockStorePlanFeatureDenial(principal.storeId, "customer_segments");
  if (denial) throw new MockHttpError(402, "PLAN_FEATURE_REQUIRED", String((denial.body as { message: string }).message));
}

export function registerCustomerSummaryAndSegmentMockHandlers(): void {
  registerMockRoute("GET", "/seller/customers/summary", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, buildCustomersSummary());
  });

  registerMockRoute("GET", "/seller/customers/segments", (request) => {
    requireSegmentsPlan(request);
    return respondWithJson(200, { data: listEveryCustomerSegment(), nextCursor: null });
  });

  registerMockRoute("POST", "/seller/customers/segments", (request) => {
    requireSegmentsPlan(request);
    const input = readSegmentInput(request);
    const issues = validateCustomerSegmentInput(input);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const segments = readCustomSegments();
    if (segments.length >= 20) throw new MockHttpError(409, "SEGMENT_LIMIT_REACHED", "You can keep up to 20 custom segments.");
    const segment: StoredCustomerSegment = { id: createMockIdentifier("seg"), ...input, createdAt: new Date().toISOString() };
    segments.push(segment);
    return respondWithJson(201, presentSegment(segment, "custom", listCustomersWithPurchaseStats()));
  });

  registerMockRoute("PATCH", "/seller/customers/segments/:segmentId", (request) => {
    requireSegmentsPlan(request);
    const segments = readCustomSegments();
    const segmentIndex = segments.findIndex((segment) => segment.id === request.params.segmentId);
    const current = segments[segmentIndex];
    if (!current) throw new MockHttpError(404, "SEGMENT_NOT_FOUND", "Only custom segments can be edited.");
    const input = readSegmentInput(request);
    const issues = validateCustomerSegmentInput(input);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const updated = { ...current, ...input };
    segments[segmentIndex] = updated;
    return respondWithJson(200, presentSegment(updated, "custom", listCustomersWithPurchaseStats()));
  });

  registerMockRoute("DELETE", "/seller/customers/segments/:segmentId", (request) => {
    requireSegmentsPlan(request);
    const segments = readCustomSegments();
    const segmentIndex = segments.findIndex((segment) => segment.id === request.params.segmentId);
    if (segmentIndex < 0) throw new MockHttpError(404, "SEGMENT_NOT_FOUND", "Only custom segments can be deleted.");
    segments.splice(segmentIndex, 1);
    return respondWithNoContent();
  });
}
