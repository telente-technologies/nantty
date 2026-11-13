import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CartItem } from "@/types";
import { activeReturnForOrder, maxReturnQuantity, toReturnRequestInput, validateReturnDraft } from "./returnRequests.util";

const items: readonly CartItem[] = [
  { id: "line-1", product: { id: "product-1", name: "Bag", price: { amountMinor: 2000, currency: "NGN" }, imageUrl: null }, quantity: 2, variant: null },
];

describe("return request form rules", () => {
  it("requires a selected line and a useful reason", () => {
    assert.equal(validateReturnDraft(items, {}, "because"), "Choose at least one item to return.");
    assert.equal(validateReturnDraft(items, { "line-1": 1 }, "no"), "Add a reason with at least 5 characters.");
    assert.equal(validateReturnDraft(items, { "line-1": 1 }, "Changed mind"), null);
  });

  it("bounds quantities to the purchased amount and supported maximum", () => {
    assert.equal(maxReturnQuantity(items[0]!), 2);
    assert.match(validateReturnDraft(items, { "line-1": 3 }, "Changed mind") ?? "", /quantity/);
  });

  it("builds the backend input without unselected lines", () => {
    assert.deepEqual(toReturnRequestInput(items, { "line-1": 1 }, "  Changed mind  "), {
      lines: [{ orderItemId: "line-1", quantity: 1 }],
      reason: "Changed mind",
    });
  });

  it("keeps requested and approved requests active", () => {
    assert.equal(activeReturnForOrder("requested"), true);
    assert.equal(activeReturnForOrder("approved"), true);
    assert.equal(activeReturnForOrder("declined"), false);
  });
});
