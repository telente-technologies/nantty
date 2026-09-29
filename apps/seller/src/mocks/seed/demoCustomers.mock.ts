import type { CurrencyCode } from "@/types/money.type";
import type { Customer } from "@/types/customer.type";
import { buildStoreScopedRecordId, type DemoCustomerPlan } from "@/mocks/seed/demoStoreProfile.mock";
import { buildIsoDateDaysAgo } from "@/mocks/seed/seededRandom.mock";

export function buildDemoCustomersFromPlan(plan: DemoCustomerPlan, recordKey: string | null, currency: CurrencyCode): Customer[] {
  return plan.rows.map(([name, phone, email, username, tags, loyaltyPoints], index) => ({
    id: buildStoreScopedRecordId("cus", recordKey, String(index + 1).padStart(3, "0")),
    name,
    phone,
    email,
    zudomartUsername: username,
    tags,
    notes: index === 0 && plan.firstCustomerNote
      ? [{ id: buildStoreScopedRecordId("note", recordKey, 1), body: plan.firstCustomerNote.body, author: { id: plan.firstCustomerNote.authorStaffId, name: plan.firstCustomerNote.authorName }, createdAt: buildIsoDateDaysAgo(20) }]
      : [],
    loyaltyPoints,
    totalSpent: { amountMinor: 0, currency },
    purchasesCount: 0,
    lastPurchaseAt: null,
    createdAt: buildIsoDateDaysAgo(150 - index * 9),
    marketingOptIn: index % 3 !== 1,
  }));
}
