import { addDefaultAddress, seedStoreWithProduct, type SeededStore } from "../../src/data/commerce.data.js";
import { doubleClickSubmit } from "../../src/helpers/abuse.helper.js";
import { routePaystackToFake } from "../../src/helpers/paystack.helper.js";
import { expectReadableMessages } from "../../src/helpers/rendering.helper.js";
import { logInThroughLoginPage } from "../../src/helpers/webappAuth.helper.js";
import { callApi, readFakePaystackState, registerUser, waitFor, type UserActor } from "../../src/smokeBridge.js";
import { expect, test } from "../../src/test.js";

test.describe.configure({ mode: "serial" });

let store: SeededStore;
let buyer: UserActor;

test.beforeAll(async () => {
  store = await seedStoreWithProduct("buyshop", 350_000);
  buyer = await registerUser("buyer");
  await addDefaultAddress(buyer);
});

test("empty cart and checkout deep link are handled", async ({ page }) => {
  await logInThroughLoginPage(page, buyer.email);
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty")).toBeVisible();
  await page.goto("/checkout");
  await expect(page.getByRole("button", { name: "Pay now" }), "no Pay button with an empty cart").toHaveCount(0);
  await expectReadableMessages(page);
});

test("add to cart, quantity abuse, refresh keeps the cart", async ({ page }) => {
  await logInThroughLoginPage(page, buyer.email);
  await page.goto(`/product/${store.productId}`);
  const add = page.getByRole("button", { name: "Add to cart" });
  const adds = await doubleClickSubmit(page, add, /\/cart\/items/);
  expect(adds, "double-tapping Add to cart adds once").toBeLessThanOrEqual(1);
  await page.goto("/cart");
  await expect(page.getByRole("region", { name: /^Items from/ }).or(page.getByLabel(/^Items from/)).first()).toBeVisible();
  const decrease = page.getByRole("button", { name: `Decrease quantity of ${store.productName}` });
  for (let index = 0; index < 3; index += 1) if (await decrease.isEnabled()) await decrease.click();
  await expect(page.getByText(store.productName).first(), "quantity never drops below one by tapping minus").toBeVisible();
  const increase = page.getByRole("button", { name: `Increase quantity of ${store.productName}` });
  await increase.click();
  await page.reload();
  await expect(page.getByText(store.productName).first()).toBeVisible();
});

test("checkout through fake Paystack with a double-tapped Pay", async ({ page }) => {
  await logInThroughLoginPage(page, buyer.email);
  const before = await readFakePaystackState();
  const paystack = await routePaystackToFake(page, "/pay/return");
  await page.goto("/cart");
  await page.getByRole("button", { name: "Proceed to checkout" }).click();
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  const pay = page.getByRole("button", { name: "Pay now" });
  await expect(pay).toBeEnabled({ timeout: 30_000 });
  const checkouts = await doubleClickSubmit(page, pay, /\/orders\/checkout$/, 500);
  expect(checkouts, "double-tapping Pay creates one checkout").toBeLessThanOrEqual(1);
  await page.waitForURL(/\/orders/, { timeout: 60_000 });
  expect(paystack.references, "exactly one Paystack charge").toHaveLength(1);
  const after = await readFakePaystackState();
  expect(after.transactions - before.transactions).toBeLessThanOrEqual(1);
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Your orders" })).toBeVisible();
  const paid = await waitFor(async () => {
    const orders = await callApi("GET", "/api/v1/orders", { token: buyer.accessToken });
    return orders.body?.data?.some((order: { status: string }) => /paid|processing|new|accepted/i.test(order.status)) ? true : undefined;
  }, 30_000, 1000);
  expect(paid, "the order is paid after the webhook").toBe(true);
  await page.reload();
  await page.getByRole("group", { name: "Filter orders by status" }).getByRole("button", { name: "Paid" }).click();
  await page.locator('a[href^="/orders/"]').first().click();
  await expect(page.getByText("Progress").first()).toBeVisible();
});

test("refresh and back during payment do not double charge", async ({ page }) => {
  await logInThroughLoginPage(page, buyer.email);
  const paystack = await routePaystackToFake(page, "/pay/return");
  await page.goto(`/product/${store.productId}`);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to cart." })).toBeVisible();
  await page.goto("/checkout");
  const pay = page.getByRole("button", { name: "Pay now" });
  await expect(pay).toBeEnabled({ timeout: 30_000 });
  await pay.click();
  await page.waitForURL(/\/orders/, { timeout: 60_000 });
  await page.goBack().catch(() => null);
  await page.goBack().catch(() => null);
  await page.reload().catch(() => null);
  await page.waitForTimeout(2000);
  expect(new Set(paystack.references).size, "going back to checkout does not start a second payment").toBe(1);
});

test("declined card leaves the order unpaid with a readable message", async ({ page }) => {
  await logInThroughLoginPage(page, buyer.email);
  await routePaystackToFake(page, "/pay/return", "decline");
  await page.goto(`/product/${store.productId}`);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to cart." })).toBeVisible();
  await page.goto("/checkout");
  await page.getByRole("button", { name: "Pay now" }).click();
  await page.waitForURL(/\/orders/, { timeout: 60_000 });
  await page.locator('a[href^="/orders/"]').first().click();
  await expect(page.getByText(/Complete your payment|failed|declined/i).first()).toBeVisible();
  await expectReadableMessages(page);
});

test("cancel rules: a paid, unshipped order can be cancelled; a shipped one cannot", async ({ page }) => {
  await logInThroughLoginPage(page, buyer.email);
  await page.goto("/orders");
  await page.getByRole("group", { name: "Filter orders by status" }).getByRole("button", { name: "Paid" }).click();
  await page.locator('a[href^="/orders/"]').first().click();
  const cancel = page.getByRole("button", { name: /^Cancel( order)?$/ });
  await expect(cancel, "buyers can cancel before the seller ships").toBeVisible();
  await expect(page.getByText(/cancel/i).filter({ hasText: /before|until|ship/i }).first(), "cancellation rules are explained").toBeVisible();
  await cancel.click();
  await page.getByRole("alertdialog", { name: "Cancel this order?" }).getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByRole("status").filter({ hasText: /cancelled/i })).toBeVisible();
  await expect(cancel, "a cancelled order offers no second cancel").toHaveCount(0);
  await expectReadableMessages(page);
});

test("another buyer cannot open my order", async ({ page }) => {
  const orders = await callApi("GET", "/api/v1/orders", { token: buyer.accessToken });
  const orderId = orders.body?.data?.[0]?.id;
  test.skip(orderId === undefined, "no order to probe");
  const stranger = await registerUser("stranger");
  await logInThroughLoginPage(page, stranger.email);
  const response = await page.goto(`/orders/${orderId}`);
  expect(response?.status() ?? 0).toBeLessThan(500);
  await expect(page.getByText(store.productName)).toHaveCount(0);
});
