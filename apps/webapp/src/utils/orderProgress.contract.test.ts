import assert from "node:assert/strict";
import test from "node:test";

import { canConfirmOrderReceipt, orderProgressSteps, resolveOrderProgress } from "@nantty/contracts";

test("order progress maps every active API status to a visible lifecycle stage", () => {
  assert.deepEqual(
    ["pending", "new", "paid", "processing", "ready", "shipped", "delivered", "completed"].map((status) => resolveOrderProgress(status).currentIndex),
    [0, 0, 1, 2, 3, 4, 5, 6],
  );
  assert.equal(orderProgressSteps.length, 7);
});

test("terminal order states retain the last known public lifecycle checkpoint", () => {
  const timeline = [{ kind: "placed" }, { kind: "paid" }, { kind: "shipped" }, { kind: "disputed" }];
  assert.deepEqual(resolveOrderProgress("disputed", timeline), {
    currentIndex: 4,
    terminalMessage: "A dispute is open. View the dispute for updates.",
  });
});

test("unknown terminal history is not presented as a fabricated progress stage", () => {
  assert.deepEqual(resolveOrderProgress("refunded"), {
    currentIndex: null,
    terminalMessage: "Payment was refunded.",
  });
});

test("receipt confirmation is only available after the order is delivered", () => {
  assert.equal(canConfirmOrderReceipt("shipped"), false);
  assert.equal(canConfirmOrderReceipt("delivered"), true);
  assert.equal(canConfirmOrderReceipt("completed"), false);
});
