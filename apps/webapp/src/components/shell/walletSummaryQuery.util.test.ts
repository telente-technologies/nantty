import assert from "node:assert/strict";
import test from "node:test";

import { walletSummaryQueryOptions } from "./walletSummaryQuery.util";

test("wallet summary queries stay disabled for guests", () => {
  const options = walletSummaryQueryOptions(null);

  assert.equal(options.wallet.enabled, false);
  assert.equal(options.coins.enabled, false);
  assert.deepEqual(options.wallet.queryKey, ["rail", "wallet", null]);
  assert.deepEqual(options.coins.queryKey, ["rail", "coins", null]);
});

test("wallet summary cache entries are isolated by signed-in account", () => {
  const firstAccount = walletSummaryQueryOptions("user-1");
  const secondAccount = walletSummaryQueryOptions("user-2");

  assert.equal(firstAccount.wallet.enabled, true);
  assert.equal(firstAccount.coins.enabled, true);
  assert.notDeepEqual(firstAccount.wallet.queryKey, secondAccount.wallet.queryKey);
  assert.notDeepEqual(firstAccount.coins.queryKey, secondAccount.coins.queryKey);
});
