import assert from "node:assert/strict";
import test from "node:test";

import type { CartShippingQuote } from "@/types";
import { readShippingQuoteFromWire } from "./cartWire.util";
import { isCheckoutShippingQuoteReady } from "./checkoutShippingQuote.util";

const quote: CartShippingQuote = {
  addressId: "address-current",
  shippingQuoteRevision: "a".repeat(64),
  groups: [],
  shipping: { amountMinor: 0, currency: "NGN" },
  total: { amountMinor: 10_000, currency: "NGN" },
};

test("keeps the server-selected address on a shipping quote", () => {
  const parsed = readShippingQuoteFromWire({
    addressId: "address-current",
    shippingQuoteRevision: "b".repeat(64),
    items: [],
    itemsTotal: { amountMinor: 10_000, currency: "NGN" },
    shopDiscount: { amountMinor: 0, currency: "NGN" },
    storeCredit: { amountMinor: 0, currency: "NGN" },
    shipping: { amountMinor: 0, currency: "NGN" },
    total: { amountMinor: 10_000, currency: "NGN" },
    groups: [],
  });

  assert.equal(parsed.addressId, "address-current");
  assert.equal(parsed.shippingQuoteRevision, "b".repeat(64));
});

test("accepts a resolved quote for the selected address", () => {
  assert.equal(isCheckoutShippingQuoteReady({ selectedAddressId: "address-current", quote, isFetching: false, isError: false }), true);
});

test("rejects missing or stale-address quotes", () => {
  assert.equal(isCheckoutShippingQuoteReady({ selectedAddressId: "address-current", quote: null, isFetching: false, isError: false }), false);
  assert.equal(isCheckoutShippingQuoteReady({ selectedAddressId: "address-next", quote, isFetching: false, isError: false }), false);
});

test("rejects quotes while recalculating or after a quote error", () => {
  assert.equal(isCheckoutShippingQuoteReady({ selectedAddressId: "address-current", quote, isFetching: true, isError: false }), false);
  assert.equal(isCheckoutShippingQuoteReady({ selectedAddressId: "address-current", quote, isFetching: false, isError: true }), false);
});

test("rejects a quote without a backend revision", () => {
  assert.equal(isCheckoutShippingQuoteReady({ selectedAddressId: "address-current", quote: { ...quote, shippingQuoteRevision: null }, isFetching: false, isError: false }), false);
});

