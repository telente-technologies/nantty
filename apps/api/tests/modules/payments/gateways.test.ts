import { describe, expect, it } from "vitest";

import { convertMajorUnitsToMinorUnits, convertMinorUnitsToMajorUnits, FlutterwaveGateway } from "../../../src/modules/payments/gateways/flutterwave.gateway.js";
import { computePaystackSignature, PaystackGateway } from "../../../src/modules/payments/gateways/paystack.gateway.js";

const body = new TextEncoder().encode(JSON.stringify({ event: "charge.success", data: { id: 42, reference: "zm_abc" } }));

function headers(values: Record<string, string>) {
  return (name: string) => values[name];
}

describe("Paystack webhook signatures", () => {
  const gateway = new PaystackGateway("sk_test_secret");

  it("accepts an HMAC-SHA512 signature of the raw body", () => {
    const signature = computePaystackSignature(body, "sk_test_secret");
    expect(gateway.verifyWebhookSignature(body, headers({ "x-paystack-signature": signature }))).toBe(true);
  });

  it("rejects tampered bodies, wrong keys and missing headers", () => {
    const signature = computePaystackSignature(body, "sk_test_secret");
    const tampered = new TextEncoder().encode(JSON.stringify({ event: "charge.success", data: { id: 42, reference: "zm_other" } }));
    expect(gateway.verifyWebhookSignature(tampered, headers({ "x-paystack-signature": signature }))).toBe(false);
    expect(gateway.verifyWebhookSignature(body, headers({ "x-paystack-signature": computePaystackSignature(body, "other") }))).toBe(false);
    expect(gateway.verifyWebhookSignature(body, headers({}))).toBe(false);
    expect(new PaystackGateway("").verifyWebhookSignature(body, headers({ "x-paystack-signature": computePaystackSignature(body, "") }))).toBe(false);
  });

  it("reads the event key and reference", () => {
    expect(gateway.readWebhookNotice(body)).toEqual({ eventKey: "charge.success:42", reference: "zm_abc", eventType: "charge.success" });
  });
});

describe("Flutterwave webhook hash", () => {
  const gateway = new FlutterwaveGateway("FLWSECK_TEST", "configured-hash");

  it("accepts only the configured verif-hash", () => {
    expect(gateway.verifyWebhookSignature(body, headers({ "verif-hash": "configured-hash" }))).toBe(true);
    expect(gateway.verifyWebhookSignature(body, headers({ "verif-hash": "configured-hasx" }))).toBe(false);
    expect(gateway.verifyWebhookSignature(body, headers({}))).toBe(false);
    expect(new FlutterwaveGateway("key", "").verifyWebhookSignature(body, headers({ "verif-hash": "" }))).toBe(false);
  });

  it("converts between minor and major units using each currency's digits", () => {
    expect(convertMinorUnitsToMajorUnits(150_050, "NGN")).toBe(1500.5);
    expect(convertMajorUnitsToMinorUnits(1500.5, "NGN")).toBe(150_050);
    expect(convertMajorUnitsToMinorUnits(0.1 + 0.2, "USD")).toBe(30);
    expect(convertMinorUnitsToMajorUnits(1_999, "GHS")).toBe(19.99);
  });
});
