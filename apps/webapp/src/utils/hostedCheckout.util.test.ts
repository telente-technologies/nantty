import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readHostedCheckoutUrl } from "./hostedCheckout.util";

const origin = "https://zudomart.com";

describe("readHostedCheckoutUrl", () => {
  it("prefers the provider-neutral checkoutUrl and allows the payment partners' hosts", () => {
    assert.equal(readHostedCheckoutUrl({ checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/abc", authorizationUrl: "https://checkout.paystack.com/x", reference: "r" }, origin), "https://checkout.flutterwave.com/v3/hosted/pay/abc");
    assert.equal(readHostedCheckoutUrl({ authorizationUrl: "https://checkout.paystack.com/x", reference: "r" }, origin), "https://checkout.paystack.com/x");
  });

  it("allows same-origin demo pages", () => {
    assert.equal(readHostedCheckoutUrl({ checkoutUrl: "/pay/demo?reference=r", reference: "r" }, origin), "/pay/demo?reference=r");
  });

  it("blocks other hosts, plain http, protocol-relative and script links", () => {
    for (const checkoutUrl of ["https://evil.example/pay", "http://checkout.flutterwave.com/x", "//evil.example/pay", "javascript:alert(1)", "https://checkout.flutterwave.com.evil.example/x", ""]) {
      assert.equal(readHostedCheckoutUrl({ checkoutUrl, reference: "r" }, origin), null, checkoutUrl);
    }
  });
});
