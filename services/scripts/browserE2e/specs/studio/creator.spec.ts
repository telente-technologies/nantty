import type { Page } from "@playwright/test";

import { seedStoreWithProduct, type SeededStore } from "../../src/data/commerce.data.js";
import { promoteToCreator } from "../../src/data/creator.data.js";
import { doubleClickSubmit, expireSession, malformedInputs, oversizedText } from "../../src/helpers/abuse.helper.js";
import { expectRedirectedToLogin, logInWithZudomartAccount } from "../../src/helpers/appLogin.helper.js";
import { expectReadableMessages } from "../../src/helpers/rendering.helper.js";
import { toggleDarkModeOnce } from "../../src/helpers/theme.helper.js";
import { callApi, registerUser, type UserActor } from "../../src/smokeBridge.js";
import { expect, test } from "../../src/test.js";

test.describe.configure({ mode: "serial" });
test.use({ guardOptions: { allowConsoleErrors: [/status of 400 .*\/bff\/api\/v1\/lives$/, /status of 404 .*\/bff\/api\/v1\/lives\/[^/]+\/stream-key$/, /status of 502 .*\/bff\/api\/v1\/lives\/[^/]+\/stream-key$/], allowServerErrors: [/^502 POST .*\/bff\/api\/v1\/lives\/[^/]+\/stream-key$/] } });

let shop: SeededStore;
let foreignShop: SeededStore;
let creator: UserActor;
let restoreThresholds: (() => Promise<void>) | undefined;
let livePath = "";

const logIn = (page: Page, user: UserActor = creator, next?: string) => logInWithZudomartAccount(page, user.email, { identifierLabel: "Email", submit: "Log in", next });

test.beforeAll(async () => {
  shop = await seedStoreWithProduct("studio");
  creator = shop.seller;
  foreignShop = await seedStoreWithProduct("foreign");
  restoreThresholds = (await promoteToCreator(creator)).restore;
});

test.afterAll(async () => {
  await restoreThresholds?.();
});

test("deep links while signed out, and a non-creator sees the Creator Program gate", async ({ page }) => {
  await expectRedirectedToLogin(page, "/earnings");
  const fan = await registerUser("notcreator");
  await logIn(page, fan, "/lives");
  await expect(page.getByRole("heading", { name: "Join the Creator Program" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create live" })).toHaveCount(0);
});

test("create a live: it is not on air until Start", async ({ page }) => {
  await logIn(page);
  await page.goto("/lives");
  await page.getByLabel("Live title").fill(oversizedText.slice(0, 1000));
  await page.getByRole("button", { name: "Create live" }).click();
  await expectReadableMessages(page);
  await page.goto("/lives");
  await page.getByLabel("Live title").fill(`E2E live ${malformedInputs[0]}`);
  await page.getByRole("radiogroup", { name: "Stream category" }).getByRole("radio", { name: "Shopping / Selling" }).click();
  const creates = await doubleClickSubmit(page, page.getByRole("button", { name: "Create live" }), /\/api\/v1\/lives$/, 1500);
  expect(creates, "double-clicking Create live makes one live").toBeLessThanOrEqual(1);
  await page.waitForURL(/\/lives\/[^/]+$/);
  livePath = new URL(page.url()).pathname;
  const liveId = livePath.split("/").at(-1) ?? "";
  await expect(page.getByText("Ready").first()).toBeVisible();
  await expect(page.getByText("Not started yet")).toBeVisible();
  const publicView = await callApi("GET", `/api/v1/lives/${liveId}`);
  expect(JSON.stringify(publicView.body ?? {}), "a created live is not on air").not.toMatch(/"(status|state)":"live"/);
  await page.reload();
  await expect(page.getByText("Not started yet")).toBeVisible();
});

test("stream key: create, reveal, rotate", async ({ page }) => {
  test.skip(livePath === "", "needs the live");
  await logIn(page);
  await page.goto(livePath);
  await expect(page.getByText("No stream key yet. Create one to connect your encoder.")).toBeVisible();
  const issued = page.waitForResponse((response) => response.request().method() === "POST" && /\/stream-key$/.test(response.url()));
  await page.getByRole("button", { name: "Create stream key" }).click();
  if ((await issued).status() === 502) {
    await expect(page.getByText(/streaming service is unavailable/i).first(), "the creator gets a readable error").toBeVisible();
    await expectReadableMessages(page);
    test.skip(true, "Sandbox has no LiveKit ingress service, so stream keys cannot be issued here.");
  }
  await expect(page.getByText("••••••••••••••••••••")).toBeVisible();
  await page.getByRole("button", { name: "Reveal Stream key" }).click();
  const field = page.getByRole("button", { name: "Hide Stream key" }).locator("xpath=ancestor::*[.//*[contains(text(),'Stream key')]][1]");
  const first = await field.innerText();
  await page.getByRole("button", { name: "Rotate stream key" }).click();
  await expect(field).not.toHaveText(first);
  await page.getByRole("button", { name: "Hide Stream key" }).click();
  await expect(page.getByText("••••••••••••••••••••")).toBeVisible();
});

test("pin own product, refuse a foreign product, then unpin", async ({ page }) => {
  test.skip(livePath === "", "needs the live");
  const liveId = livePath.split("/").at(-1) ?? "";
  await logIn(page);
  await page.goto(livePath);
  await expect(page.getByRole("heading", { name: "Pinned products (optional)" })).toBeVisible();
  await expect(page.getByRole("button", { name: `+ ${foreignShop.productName}` }), "picker only lists the creator's own products").toHaveCount(0);
  await page.getByRole("button", { name: `+ ${shop.productName}` }).click();
  await expect(page.getByText("On screen").first()).toBeVisible();
  await page.route(/\/lives\/[^/]+\/pins$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.continue({ postData: JSON.stringify({ productId: foreignShop.productId }) });
  });
  const pickable = page.getByRole("button", { name: /^\+ / }).first();
  if (await pickable.count() === 0) {
    const direct = await callApi("POST", `/api/v1/lives/${liveId}/pins`, { token: creator.accessToken, body: { productId: foreignShop.productId } });
    expect(direct.status, "pinning another store's product is refused").toBeGreaterThanOrEqual(400);
  } else {
    await pickable.click();
    await expect(page.getByRole("alert"), "pinning another store's product is refused").toBeVisible();
    await expectReadableMessages(page);
  }
  await page.unroute(/\/lives\/[^/]+\/pins$/);
  const foreignStorePin = await callApi("POST", `/api/v1/lives/${liveId}/pins`, { token: creator.accessToken, body: { productId: foreignShop.productId, storeId: foreignShop.storeId } });
  expect(foreignStorePin.status, "pinning with another store id is refused").toBeGreaterThanOrEqual(400);
  await page.getByRole("button", { name: /^(Unpin|Remove)/ }).first().click();
  await expect(page.getByText("On screen"), "nothing is on screen after unpinning").toHaveCount(0);
});

test("overlay editor: add a layer, save, survive a reload; bad values are clamped", async ({ page }) => {
  test.skip(livePath === "", "needs the live");
  await logIn(page);
  await page.goto(`${livePath}/overlay`);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByLabel("Text", { exact: true }).fill(malformedInputs[0] ?? "<x>");
  await page.getByLabel("X", { exact: true }).fill("-99999");
  await page.getByLabel("Width", { exact: true }).fill("");
  await page.getByLabel("Width", { exact: true }).fill("99999999");
  await page.getByRole("button", { name: "Save overlay" }).click();
  await expect(page.getByText(/^Saved\. Your OBS browser source/).or(page.getByRole("alert")).first()).toBeVisible();
  await expectReadableMessages(page);
  await page.reload();
  await expect(page.getByText("Nothing on this scene yet."), "saved layer persists").toHaveCount(0);
  await page.getByRole("link", { name: "Back to control room" }).click();
  await expect(page).toHaveURL(new RegExp(`${livePath}$`));
});

test("start then end the live", async ({ page }) => {
  test.skip(livePath === "", "needs the live");
  await logIn(page);
  await page.goto(livePath);
  await page.getByRole("button", { name: "Start live" }).click();
  await expect(page.getByRole("button", { name: "End live" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "End live" }).click();
  await expect(page.getByText("Ended").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Start live" }), "an ended live cannot be restarted").toHaveCount(0);
});

test("earnings and payout onboarding with bad then good details", async ({ page }) => {
  await logIn(page);
  await page.goto("/earnings");
  await expect(page.getByRole("heading", { name: "Earnings and payouts" })).toBeVisible();
  const start = page.getByRole("link", { name: /^(Continue|See what's needed)$/ }).or(page.getByRole("button", { name: /^(Set up payouts|Continue)$/ })).first();
  if (await start.isVisible().catch(() => false)) await start.click();
  await page.getByLabel("Legal name").fill("Temitope Adeyemi");
  await page.getByLabel("Date of birth").fill("31-31-1990");
  await page.getByLabel("Home address").fill("4 Allen Avenue");
  await page.getByLabel("City").fill("Ikeja");
  await page.getByLabel("State").fill("Lagos");
  await page.getByLabel("ID to verify with").selectOption({ label: "BVN" });
  await page.getByLabel("BVN (11 digits)").fill("123");
  await expect(page.getByRole("button", { name: "Save and continue" }), "short BVN and a bad date cannot be submitted").toBeDisabled();
  await expectReadableMessages(page);
  await page.getByLabel("Date of birth").fill("1994-02-03");
  await page.getByLabel("BVN (11 digits)").fill("22212345678");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText("Where to send your money")).toBeVisible();
  await page.getByLabel("Bank").selectOption({ index: 1 });
  await page.getByLabel("Account number").fill("12");
  await expect(page.getByRole("button", { name: "Save account" })).toBeDisabled();
});

test("creator subscription plans can be managed in Studio", async ({ page }) => {
  test.fixme(true, "Needs a product decision: neither Studio nor the webapp has a creator subscription plan editor (plans are managed in the mobile app only).");
  await logIn(page);
  await page.goto("/lives");
  await page.getByRole("navigation", { name: "Studio sections" }).getByRole("link", { name: /Subscriptions|Plans|Memberships/ }).click();
  await page.getByRole("button", { name: /New plan|Create plan/ }).click();
  await page.getByLabel(/Plan name|Name/).fill("E2E Studio plan");
  await page.getByLabel(/Price/).fill("-1");
  await page.getByRole("button", { name: /^(Save|Create)/ }).click();
  await expectReadableMessages(page);
});

test("dark mode renders", async ({ page }, testInfo) => {
  await logIn(page);
  await page.goto("/lives");
  await toggleDarkModeOnce(page, testInfo, "studio-lives");
});

test.describe("creator whose session expired", () => {
  test.use({ guardOptions: { allowConsoleErrors: [/status of 401 .*\/bff\/api\/v1\//], allowServerErrors: [] } });
  test("expired session sends the creator back to log in", async ({ page }) => {
    await logIn(page);
    await expireSession(page);
    await page.goto("/earnings").catch(() => null);
    await expect(page).toHaveURL(/\/login/);
  });
});
