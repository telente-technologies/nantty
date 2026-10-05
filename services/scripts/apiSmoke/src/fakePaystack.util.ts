import { callApi, describeResponse } from "./apiClient.util.js";

const fakePaystackUrl = process.env["SMOKE_FAKE_PAYSTACK_URL"] ?? "http://127.0.0.1:18999";

async function deliverSignedWebhook(signed: { readonly body: string; readonly signature: string }): Promise<void> {
  const delivered = await callApi("POST", "/webhooks/paystack", { rawBody: signed.body, headers: { "content-type": "application/json", "x-paystack-signature": signed.signature }, idempotent: false });
  if (delivered.status !== 200) throw new Error(`webhook delivery: ${describeResponse(delivered)}`);
}

export async function payCheckoutThroughFakePaystack(reference: string, feeMinor = 0, card: "good" | "decline" = "good"): Promise<void> {
  const response = await fetch(`${fakePaystackUrl}/__smoke/charges/${encodeURIComponent(reference)}/complete?fee=${feeMinor}&card=${card}`, { method: "POST" });
  if (response.status !== 200) throw new Error(`fake Paystack charge ${response.status}: ${await response.text()}`);
  await deliverSignedWebhook((await response.json()) as { body: string; signature: string });
}

export async function settleTransferThroughFakePaystack(reference: string, status: "success" | "failed" | "reversed" = "success"): Promise<void> {
  const response = await fetch(`${fakePaystackUrl}/__smoke/transfers/${encodeURIComponent(reference)}/${status}`, { method: "POST" });
  if (response.status !== 200) throw new Error(`fake Paystack transfer ${response.status}: ${await response.text()}`);
  await deliverSignedWebhook((await response.json()) as { body: string; signature: string });
}

export async function readFakePaystackState(): Promise<{ readonly transactions: number; readonly transfers: Record<string, { Reference: string; Status: string; AmountMinor: number }>; readonly refunds: unknown[] | null }> {
  const response = await fetch(`${fakePaystackUrl}/__smoke/state`);
  return (await response.json()) as never;
}
