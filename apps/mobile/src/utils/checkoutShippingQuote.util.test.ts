import { describe, expect, it } from "@jest/globals";

import { isCheckoutShippingQuoteReady, type CheckoutShippingQuoteState } from "./checkoutShippingQuote.util";

const readyState: CheckoutShippingQuoteState = {
  selectedAddressId: "address-current",
  quoteAddressId: "address-current",
  shippingQuoteRevision: "a".repeat(64),
  hasQuote: true,
  isFetching: false,
  isPlaceholderData: false,
  isError: false,
};

describe("isCheckoutShippingQuoteReady", () => {
  it("allows checkout only with a completed quote for the selected address", () => {
    expect(isCheckoutShippingQuoteReady(readyState)).toBe(true);
  });

  it.each([
    ["no selected address", { selectedAddressId: null }],
    ["quote belongs to a previous address", { quoteAddressId: "address-previous" }],
    ["quote has no backend revision", { shippingQuoteRevision: null }],
    ["placeholder quote", { isPlaceholderData: true }],
    ["quote still loading", { isFetching: true }],
    ["failed quote", { isError: true }],
  ])("blocks checkout when %s", (_label, change) => {
    expect(isCheckoutShippingQuoteReady({ ...readyState, ...change })).toBe(false);
  });
});
