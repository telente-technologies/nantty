import type { Page, Route } from "@playwright/test";

import { payCardCheckout } from "../../../apiSmoke/src/fakeFlutterwave.util.js";

// go-money returns the fake's hosted link (http://127.0.0.1:18998/hosted/pay/<tx_ref>). The webapp only opens https links on
// Flutterwave's own hosts, so the BFF response is rewritten to the sandbox checkout host, and that host is served here:
// the charge completes through the fake (signed webhook to go-money), then the browser lands on the return page,
// which polls GET /api/v1/payments/{reference}.
const sandboxCheckoutOrigin = "https://checkout-testing.flutterwave.com";
const fakeHostedLink = /https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/hosted\/pay\//g;

export interface FakeFlutterwaveHandle {
  readonly references: string[];
}

export async function routeFlutterwaveToFake(page: Page, returnPath: string, outcome: "successful" | "abandoned" = "successful"): Promise<FakeFlutterwaveHandle> {
  const handle: FakeFlutterwaveHandle = { references: [] };
  await page.route(/\/(bff|api)\/.*/, async (route: Route) => {
    if (route.request().method() === "GET") return route.fallback();
    const response = await route.fetch().catch(() => null);
    const text = response === null ? null : await response.text().catch(() => null);
    if (response === null || text === null) return route.abort().catch(() => undefined);
    return route.fulfill({ response, body: text.replace(fakeHostedLink, `${sandboxCheckoutOrigin}/hosted/pay/`) });
  });
  await page.route(`${sandboxCheckoutOrigin}/**`, async (route) => {
    const reference = decodeURIComponent(new URL(route.request().url()).pathname.split("/").filter(Boolean).at(-1) ?? "");
    handle.references.push(reference);
    if (outcome === "successful") await payCardCheckout(reference);
    const origin = new URL(page.url()).origin;
    const separator = returnPath.includes("?") ? "&" : "?";
    const status = outcome === "successful" ? "successful" : "cancelled";
    await route.fulfill({ status: 302, headers: { location: `${origin}${returnPath}${separator}status=${status}&tx_ref=${encodeURIComponent(reference)}` } });
  });
  return handle;
}
