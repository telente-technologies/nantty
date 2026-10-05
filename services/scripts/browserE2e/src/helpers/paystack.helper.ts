import type { Page, Route } from "@playwright/test";

import { fakePaystackUrl } from "../environment.js";
import { callApi, payCheckoutThroughFakePaystack } from "../smokeBridge.js";

async function createFakeSubscription(reference: string): Promise<void> {
  const response = await fetch(`${fakePaystackUrl}/__smoke/subscriptions/${encodeURIComponent(reference)}/create`, { method: "POST" });
  if (response.status === 404) return;
  if (response.status !== 200) throw new Error(`fake Paystack subscription ${response.status}: ${await response.text()}`);
  const signed = (await response.json()) as { body: string; signature: string };
  await callApi("POST", "/webhooks/paystack", { rawBody: signed.body, headers: { "content-type": "application/json", "x-paystack-signature": signed.signature }, idempotent: false });
}

export interface FakePaystackHandle {
  readonly references: string[];
}

export async function routePaystackToFake(page: Page, returnPath: string, card: "good" | "decline" = "good"): Promise<FakePaystackHandle> {
  const handle: FakePaystackHandle = { references: [] };
  await page.route(/^https:\/\/(js|checkout)\.paystack\.(co|com)\//, (route) => route.abort("blockedbyclient"));
  await page.route(/\/(bff|api)\/.*/, async (route: Route) => {
    if (route.request().method() === "GET") return route.fallback();
    const response = await route.fetch();
    const text = await response.text();
    if (!text.includes("checkout.paystack.test")) return route.fulfill({ response, body: text });
    const body = JSON.parse(text) as Record<string, unknown>;
    const strip = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(strip);
      if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "accessCode" && key !== "access_code").map(([key, inner]) => [key, strip(inner)]));
      return value;
    };
    return route.fulfill({ response, json: strip(body) });
  });
  await page.route("https://checkout.paystack.test/**", async (route) => {
    const reference = decodeURIComponent(new URL(route.request().url()).pathname.split("/").filter(Boolean).at(-1) ?? "");
    handle.references.push(reference);
    await payCheckoutThroughFakePaystack(reference, 0, card);
    if (card === "good") await createFakeSubscription(reference);
    const origin = new URL(page.url()).origin;
    const separator = returnPath.includes("?") ? "&" : "?";
    await route.fulfill({ status: 302, headers: { location: `${origin}${returnPath}${separator}reference=${encodeURIComponent(reference)}&trxref=${encodeURIComponent(reference)}` } });
  });
  return handle;
}
