import type { CartItem } from "@/types";
import {
  activeReturnForOrder,
  maxReturnQuantity,
  toReturnRequestInput,
  validateReturnDraft,
} from "../returnRequests.util";

const items: CartItem[] = [
  { id: "line-1", quantity: 2, variant: "Large", product: { id: "p-1", name: "Shirt", imageUrl: null, price: { amountMinor: 2500, currency: "NGN" } } },
  { id: "line-2", quantity: 120, variant: null, product: { id: "p-2", name: "Bag", imageUrl: null, price: { amountMinor: 5000, currency: "NGN" } } },
];

describe("buyer return request draft", () => {
  it("caps selected quantity at both purchased amount and the API limit", () => {
    expect(maxReturnQuantity(items[0]!)).toBe(2);
    expect(maxReturnQuantity(items[1]!)).toBe(99);
  });

  it("requires at least one valid item line and a 5-500 character reason", () => {
    expect(validateReturnDraft(items, {}, "A valid reason")).toMatch(/at least one item/i);
    expect(validateReturnDraft(items, { "line-1": 3 }, "A valid reason")).toMatch(/quantity/i);
    expect(validateReturnDraft(items, { "line-1": 1 }, "   x   ")).toMatch(/at least 5/i);
    expect(validateReturnDraft(items, { "line-1": 1 }, "x".repeat(501))).toMatch(/within 500/i);
    expect(validateReturnDraft(items, { "line-1": 1 }, "  Item arrived damaged  ")).toBeNull();
  });

  it("enforces the 50-line request limit", () => {
    const manyItems: CartItem[] = Array.from({ length: 51 }, (_, index) => ({
      ...items[0]!,
      id: `line-${index}`,
    }));
    const quantities = Object.fromEntries(manyItems.map((item) => [item.id, 1]));

    expect(validateReturnDraft(manyItems, quantities, "Valid reason")).toMatch(/no more than 50/i);
    expect(validateReturnDraft(manyItems.slice(0, 50), quantities, "Valid reason")).toBeNull();
  });

  it("trims the reason and sends only selected order lines", () => {
    expect(toReturnRequestInput(items, { "line-2": 3 }, "  Wrong size  ")).toEqual({
      lines: [{ orderItemId: "line-2", quantity: 3 }],
      reason: "Wrong size",
    });
  });

  it("recognizes only backend active return statuses", () => {
    expect(activeReturnForOrder("requested")).toBe(true);
    expect(activeReturnForOrder("approved")).toBe(true);
    expect(activeReturnForOrder("declined")).toBe(false);
    expect(activeReturnForOrder("received")).toBe(false);
  });
});
