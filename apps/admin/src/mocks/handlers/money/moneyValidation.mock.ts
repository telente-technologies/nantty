import { failValidation } from "@/mocks/mockResponses.mock";
import type { MockRequest } from "@/mocks/mockRouter.mock";

import type { MockEscrowTimelineEvent, MockOrderRecord } from "./moneyRecords.mock";

export function readMoneyAmountInOrderCurrency(body: Record<string, unknown>, fieldName: string, currency: string): number {
  const value = body[fieldName] as { amountMinor?: unknown; currency?: unknown } | null | undefined;
  if (typeof value !== "object" || value === null) failValidation(fieldName, `${fieldName} is required.`);
  if (value.currency !== currency) failValidation(`${fieldName}.currency`, `Amount must be in ${currency}, the currency of this order.`);
  if (typeof value.amountMinor !== "number" || !Number.isSafeInteger(value.amountMinor) || value.amountMinor <= 0) failValidation(`${fieldName}.amountMinor`, "Amount must be a positive whole number of minor units.");
  return value.amountMinor;
}

export function appendEscrowTimelineEvent(order: MockOrderRecord, request: MockRequest, kind: MockEscrowTimelineEvent["kind"], note: string, amountMinor: number | null): void {
  order.timeline = [
    ...order.timeline,
    {
      id: `${order.orderNumber}-${order.timeline.length + 1}`,
      kind,
      occurredAt: new Date().toISOString(),
      actorName: request.principal?.name ?? "System",
      actorKind: request.principal ? "ADMIN" : "SYSTEM",
      note,
      amount: amountMinor === null ? null : { amountMinor, currency: order.currency },
    },
  ];
}

export function readPageFilterValue(request: MockRequest, name: string): string | null {
  const value = request.query.get(name);
  return value && value !== "all" ? value : null;
}
