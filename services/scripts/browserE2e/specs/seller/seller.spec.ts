import type { Page } from "@playwright/test";

import { seedStoreWithProduct, type SeededStore } from "../../src/data/commerce.data.js";
import { acceptTeamRequest, addStoreManager, placePaidOrder, upgradeToBusinessPlan } from "../../src/data/seller.data.js";
import { doubleClickSubmit, expireSession, malformedInputs, oversizedText } from "../../src/helpers/abuse.helper.js";
import { expectRedirectedToLogin, logInWithNanttyAccount } from "../../src/helpers/appLogin.helper.js";
import { expectReadableMessages } from "../../src/helpers/rendering.helper.js";
import { toggleDarkModeOnce } from "../../src/helpers/theme.helper.js";
import { createSamplePng, registerUser, uniqueSuffix, type UserActor } from "../../src/smokeBridge.js";
import { expect, test } from "../../src/test.js";

test.describe.configure({ mode: "serial" });
test.use({ guardOptions: { allowConsoleErrors: [/status of 404 .*\/bff\/seller\/brands(\/directory)?$/, /status of 409 .*\/bff\/seller\/inventory\/adjustments$/, /status of 400 .*\/bff\/seller\/business-documents\/[a-z_]+\/upload-intents$/], allowServerErrors: [] } });

let freeStore: SeededStore;
let secondStore: SeededStore;
let orderId = "";

const logIn = (page: Page, user: UserActor = freeStore.seller, next?: string) => logInWithNanttyAccount(page, user.email, { identifierLabel: "Email or username", submit: "Sign in", next });

test.beforeAll(async () => {
  freeStore = await seedStoreWithProduct("sellfree");
  secondStore = await seedStoreWithProduct("sellsecond", 120_000);
  await upgradeToBusinessPlan(secondStore);
  await addStoreManager(secondStore, freeStore.seller);
});

test("signed-out deep links, and a buyer without a store is sent to apply", async ({ page }) => {
  await expectRedirectedToLogin(page, "/orders");
  const buyer = await registerUser("nostore");
  await logIn(page, buyer);
  await expect(page).toHaveURL(/\/access\/apply/);
  await expect(page.getByRole("heading", { name: "This account does not have a store yet" })).toBeVisible();
  await page.goto("/products/new");
  await expect(page).toHaveURL(/\/access\/apply/);
});

test("switch between the store the seller owns and one they manage", async ({ page }) => {
  await logIn(page);
  await page.goto("/dashboard");
  await page.locator('button[aria-haspopup="menu"]').filter({ hasText: /E2E/, visible: true }).first().click();
  const menu = page.getByRole("menu", { name: "Switch store" });
  const other = menu.getByRole("menuitemradio", { checked: false }).first();
  const otherName = (await other.innerText()).split(/\n|·/)[0]?.trim() ?? "";
  await other.click();
  await expect(page.locator('button[aria-haspopup="menu"]').filter({ hasText: otherName, visible: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.locator('button[aria-haspopup="menu"]').filter({ hasText: otherName, visible: true }).first(), "store choice survives a reload").toBeVisible();
});

test("create a product with photo upload; validation and double submit", async ({ page }) => {
  await logIn(page);
  await page.goto("/products/new");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page).toHaveURL(/\/products\/new/);
  await expectReadableMessages(page);
  await page.getByLabel("Product name").fill(oversizedText.slice(0, 2000));
  await page.getByLabel("Description").fill(malformedInputs[0] ?? "");
  await page.getByRole("button", { name: "Create product" }).click();
  await expectReadableMessages(page);
  const name = `E2E dashboard product ${uniqueSuffix()}`;
  await page.getByLabel("Product name").fill(name);
  await page.locator('input[type="file"]').first().setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: createSamplePng(400, 400) });
  await expect(page.getByRole("button", { name: "Remove photo" }).first()).toBeVisible({ timeout: 60_000 });
  await page.getByLabel(/Default price|price$/).first().fill("-50");
  await page.getByRole("button", { name: "Create product" }).click();
  await expectReadableMessages(page);
  await page.getByLabel("Default SKU").fill("bad sku!!");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText(/SKU needs 1 to 64/).first(), "an invalid SKU is explained").toBeVisible();
  await page.getByLabel("Default SKU").fill(`E2E-${uniqueSuffix()}`.toUpperCase());
  await page.getByLabel(/Default price|price$/).first().fill("4500");
  await page.getByLabel(/opening stock/).first().fill("12");
  const creates = await doubleClickSubmit(page, page.getByRole("button", { name: "Create product" }), /\/bff\/seller\/products$/);
  expect(creates, "double-clicking Create product creates one").toBeLessThanOrEqual(1);
  await expect(page.getByText(`${name} created.`)).toBeVisible();
  await page.goto("/products");
  await expect(page.getByText(name)).toHaveCount(1);
});

test("inventory adjustment", async ({ page }) => {
  await logIn(page);
  await page.goto("/inventory/adjustments");
  await page.getByRole("button", { name: "New adjustment" }).click();
  const dialog = page.getByRole("dialog", { name: "Adjust stock" });
  await dialog.getByLabel("Reason").selectOption({ label: "Damaged" });
  await dialog.getByLabel("Find an item to add").fill(freeStore.productName.slice(0, 12));
  await dialog.getByRole("list", { name: "Matching items" }).getByRole("button").or(dialog.getByRole("list", { name: "Matching items" }).getByRole("option")).first().click();
  await dialog.getByLabel(/^Quantity for/).fill("-999999");
  await dialog.getByRole("button", { name: "Save adjustment" }).click();
  await expectReadableMessages(page);
  await dialog.getByLabel(/^Quantity for/).fill("-2");
  await dialog.getByRole("button", { name: "Save adjustment" }).click();
  await expect(page.getByText("Stock updated.")).toBeVisible();
});

test("orders: accept, ship, then refund", async ({ page }) => {
  ({ orderId } = await placePaidOrder(freeStore));
  await logIn(page);
  await page.goto(`/orders/${orderId}`);
  const accept = page.getByRole("button", { name: "Accept order" });
  await expect(accept).toBeVisible({ timeout: 30_000 });
  const accepts = await doubleClickSubmit(page, accept, /\/orders\/[^/]+\/accept$/);
  expect(accepts).toBeLessThanOrEqual(1);
  await expect(page.getByText(/^Accepted /)).toBeVisible();
  await page.getByRole("button", { name: "Mark as shipped" }).click();
  await expectReadableMessages(page);
  await page.getByLabel("Courier").selectOption({ label: "GIG Logistics" });
  await page.getByLabel("Tracking number").fill(`TRK${uniqueSuffix()}`);
  await page.getByLabel("Ships from").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(page.getByText(/^Marked .* as shipped/)).toBeVisible();
  await page.getByRole("button", { name: "Refund" }).click();
  const refund = page.getByRole("dialog", { name: /^Refund/ });
  await refund.getByText("Partial refund").click();
  await refund.getByLabel("Amount to refund").fill("99999999");
  await refund.getByLabel("Reason shown to the buyer").fill("E2E partial refund");
  await refund.getByRole("button", { name: "Send refund" }).click();
  await expect(refund.getByRole("alert").or(page.getByRole("alert")).first(), "refund above the order total is refused").toBeVisible();
  await expectReadableMessages(page);
  await refund.getByLabel("Amount to refund").fill("100");
  await refund.getByRole("button", { name: "Send refund" }).click();
  await expect(refund).toBeHidden();
});

test("customers, promotions and reports pages work", async ({ page }) => {
  await logIn(page);
  await page.goto("/customers");
  await page.getByRole("button", { name: "Add customer" }).click();
  const add = page.getByRole("dialog", { name: "Add a customer" });
  await add.getByLabel("Full name").fill("E2E Customer");
  await add.getByLabel("Phone number").fill("not a phone");
  await add.getByRole("button", { name: "Add customer" }).click();
  await expectReadableMessages(page);
  await add.getByLabel("Phone number").fill(`+234803${String(Date.now()).slice(-7)}`);
  await add.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByText("E2E Customer").first()).toBeVisible();
  await page.goto("/promotions/new");
  await page.getByLabel("Name").fill("E2E promo");
  await page.getByLabel("Coupon code").fill("E2E OFF!!");
  await page.getByLabel("Percent off").fill("150");
  await page.getByRole("button", { name: "Create promotion" }).click();
  await expectReadableMessages(page);
  await page.getByLabel("Coupon code").fill(`E2E${Date.now().toString(36).toUpperCase()}`);
  await page.getByLabel("Percent off").fill("10");
  await page.getByRole("button", { name: "Create promotion" }).click();
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await page.getByRole("link", { name: "Sales by day" }).click();
  await expect(page).toHaveURL(/\/reports\/sales-by-day/);
});

test("free plan: paid tools show an upgrade prompt, not a raw error", async ({ page }) => {
  await logIn(page);
  for (const path of ["/inventory/movements", "/inventory/reorder", "/marketing/flash-sales", "/staff/invite"]) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: /^Upgrade to (Pro|Business)$/ }).first(), `${path} shows the upgrade UI`).toBeVisible();
    await expect(page.getByText(/PLAN_FEATURE_REQUIRED|402/)).toHaveCount(0);
  }
});

test("business documents upload refuses bad files and accepts a PDF", async ({ page }) => {
  await logIn(page);
  await page.goto("/settings/business-documents");
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles({ name: "malware.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") });
  await expectReadableMessages(page);
  await input.setInputFiles({ name: "cac.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF") });
  await expect(page.getByText("Sent for review. You can keep selling while we look at it.")).toBeVisible({ timeout: 60_000 });
  await page.reload();
  await expect(page.getByText("In review").first()).toBeVisible();
});

test("staff roles: a sales staff member is blocked from finance and settings", async ({ page, browser }) => {
  await upgradeToBusinessPlan(freeStore);
  const member = await registerUser("staffer");
  await logIn(page);
  const finder = page.getByLabel("Find a Nantty user");
  await expect(async () => {
    await page.goto("/staff/invite");
    await expect(finder, "the new plan unlocks the team form once the short plan cache expires").toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await finder.fill(`@${member.username}`);
  await page.getByRole("list", { name: "Matching Nantty users" }).getByText(member.username).first().click();
  await page.getByLabel("Role").selectOption({ label: "Sales staff" });
  await page.getByRole("button", { name: "Send team request" }).click();
  await expect(page.getByRole("group", { name: "Works at" }).getByRole("alert"), "a location is required").toHaveText("Pick at least one location.");
  await page.getByRole("group", { name: "Works at" }).getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Send team request" }).click();
  await expect(page.getByText(`Team request sent to @${member.username}`)).toBeVisible();
  await acceptTeamRequest(member);
  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await logIn(staffPage, member);
  for (const path of ["/wallet", "/settings/billing", "/staff", "/wallet/withdraw"]) {
    await staffPage.goto(path);
    await expect(staffPage, `sales staff cannot open ${path}`).toHaveURL(/denied=|\/dashboard|\/orders|access/);
  }
  await staffPage.goto("/orders");
  await expect(staffPage.getByRole("heading", { name: "Orders" })).toBeVisible();
  await staffContext.close();
});

test("expired session goes back to sign-in", async ({ page }) => {
  await logIn(page);
  await expireSession(page);
  await page.goto("/products");
  await expect(page).toHaveURL(/\/login/);
});

test("dark mode renders", async ({ page }, testInfo) => {
  await logIn(page);
  await page.goto("/dashboard");
  await toggleDarkModeOnce(page, testInfo, "seller-dashboard");
});
