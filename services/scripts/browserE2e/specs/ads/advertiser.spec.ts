import { doubleClickSubmit, expireSession, malformedInputs, oversizedText } from "../../src/helpers/abuse.helper.js";
import { expectRedirectedToLogin, logInWithZudomartAccount } from "../../src/helpers/appLogin.helper.js";
import { routeFlutterwaveToFake } from "../../src/helpers/flutterwave.helper.js";
import { expectReadableMessages } from "../../src/helpers/rendering.helper.js";
import { toggleDarkModeOnce } from "../../src/helpers/theme.helper.js";
import { createSamplePng, registerUser, uniqueSuffix, type UserActor } from "../../src/smokeBridge.js";
import { expect, test } from "../../src/test.js";

test.describe.configure({ mode: "serial" });
test.use({ guardOptions: { allowConsoleErrors: [/status of 401 .*\/bff\/auth\/login$/, /Loading the image 'https:\/\/cdn\.zudomart\.com\/media\/[0-9a-f-]+' violates the following Content Security Policy/], allowServerErrors: [] } });

let advertiser: UserActor;
let accountPath = "";

test.beforeAll(async () => {
  advertiser = await registerUser("adv");
});

test("signed-out deep links go to sign-in and come back", async ({ page }) => {
  await expectRedirectedToLogin(page, "/accounts/new");
  await page.getByLabel("Email or username").fill(advertiser.email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /incorrect|not right|try again/i }).first()).toBeVisible();
  await expectReadableMessages(page);
  await logInWithZudomartAccount(page, advertiser.email, { next: "/accounts/new" });
  await expect(page).toHaveURL(/\/accounts\/new/);
});

test("create an ad account (with empty, oversized and double submits)", async ({ page }) => {
  await logInWithZudomartAccount(page, advertiser.email);
  await page.goto("/accounts/new");
  await page.getByText("Just me").click();
  const submit = page.getByRole("button", { name: "Create ad account" });
  await page.getByLabel("Account name").fill("");
  await submit.click();
  await expect(page).toHaveURL(/\/accounts\/new/);
  await page.getByLabel("Account name").fill(oversizedText);
  await submit.click();
  await expectReadableMessages(page);
  await page.getByLabel("Account name").fill(`E2E Ads ${uniqueSuffix()}`);
  const creates = await doubleClickSubmit(page, submit, /\/bff\/ads\/accounts$/);
  expect(creates, "double-clicking Create sends one request").toBeLessThanOrEqual(1);
  await page.waitForURL(/\/accounts\/[^/]+\/overview/);
  accountPath = new URL(page.url()).pathname.replace(/\/overview$/, "");
  await page.reload();
  await expect(page).toHaveURL(/overview/);
});

test("campaign wizard with creative upload, then clear the spend cap", async ({ page }) => {
  test.skip(accountPath === "", "needs the ad account");
  await logInWithZudomartAccount(page, advertiser.email);
  await page.goto(`${accountPath}/campaigns/new`);
  await page.getByText("Traffic & profile visits").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Campaign name").fill(`E2E campaign ${uniqueSuffix()}`);
  await page.getByLabel("Campaign spend cap (optional)").fill("50000");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: /Create campaign/ })).toBeVisible();
  await page.goBack().catch(() => null);
  await page.goForward().catch(() => null);
  await page.waitForLoadState("load").catch(() => null);
  await page.goto(`${accountPath}/campaigns/new`).catch(() => page.goto(`${accountPath}/campaigns/new`));
  await page.getByText("Traffic & profile visits").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Campaign name").fill(`E2E campaign ${uniqueSuffix()}`);
  await page.getByLabel("Campaign spend cap (optional)").fill("50000");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Ad set name").fill("E2E ad set");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/^(Daily|Lifetime) budget$/).fill("5000");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Ad name").fill("E2E ad");
  await page.getByRole("radio", { name: "Upload new" }).click();
  await page.locator('input[type="file"]').first().setInputFiles({ name: "creative.png", mimeType: "image/png", buffer: createSamplePng(600, 600) });
  await expect(page.getByAltText("Uploaded creative")).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Headline").fill(malformedInputs[0] ?? "");
  await page.getByLabel("Primary text").fill("Shop the e2e collection");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/no post or product to open/).first(), "an upload cannot point at a post").toBeVisible();
  await page.getByLabel("Button opens").selectOption({ label: "Your profile" });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Review and publish" })).toBeVisible();
  const publishes = await doubleClickSubmit(page, page.getByRole("button", { name: "Publish", exact: true }), /\/bff\/ads\/.*campaigns/);
  expect(publishes, "double-clicking Publish creates one campaign").toBeLessThanOrEqual(1);
  await page.waitForURL(/\/campaigns\/[^/]+$/);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Edit campaign" });
  await panel.getByRole("textbox", { name: "Spending limit" }).fill("");
  await panel.getByRole("button", { name: "Save changes" }).click();
  await expect(panel.getByText("Enter a spending limit or untick it.")).toBeVisible();
  await panel.getByLabel("Set a campaign spending limit").uncheck();
  await panel.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Campaign saved.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit campaign" }).getByLabel("Set a campaign spending limit"), "cleared spend cap stays cleared").not.toBeChecked();
});

test("invite a member, reject bad emails, and the invitee cannot see the account before accepting", async ({ page, browser }) => {
  test.skip(accountPath === "", "needs the ad account");
  const invitee = await registerUser("advinv");
  await logInWithZudomartAccount(page, advertiser.email);
  await page.goto(`${accountPath}/settings`);
  await page.getByLabel("Invite by email").fill("not-an-email");
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await page.getByLabel("Invite by email").fill(invitee.email);
  await page.getByLabel("Role", { exact: true }).selectOption({ label: "Analyst" });
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText(`Invite sent to ${invitee.email}`)).toBeVisible();
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await logInWithZudomartAccount(other, invitee.email);
  await other.goto(`${accountPath}/overview`);
  await expect(other).toHaveURL(/\/accounts\?denied=/);
  await expect(other.getByText(/not a member of that ad account/)).toBeVisible();
  await otherContext.close();
});

test("top up through fake Flutterwave, double-tap Pay, expired session", async ({ page }) => {
  test.skip(accountPath === "", "needs the ad account");
  await logInWithZudomartAccount(page, advertiser.email);
  const accountId = accountPath.split("/").at(-1) ?? "";
  const flutterwave = await routeFlutterwaveToFake(page, `/accounts/${accountId}/billing/return`);
  await page.goto(`${accountPath}/billing`);
  await page.getByRole("button", { name: "Add funds" }).click();
  const dialog = page.getByRole("dialog", { name: "Add funds" });
  await dialog.getByRole("textbox", { name: "Amount" }).fill("-5");
  await dialog.getByRole("button", { name: /^Continue to payment/ }).click();
  await expect(dialog.getByText(/Enter an amount|minimum top-up/).first(), "a negative top-up is refused").toBeVisible();
  await expect(page, "no checkout started").not.toHaveURL(/billing\/return/);
  await dialog.getByRole("textbox", { name: "Amount" }).fill("10000");
  const pay = dialog.getByRole("button", { name: /^Continue to payment/ });
  const topUps = await doubleClickSubmit(page, pay, /\/billing\/top-ups$/, 500);
  expect(topUps, "double-tapping Pay starts one top-up").toBeLessThanOrEqual(1);
  await page.waitForURL(/billing\/return/, { timeout: 60_000 });
  expect(flutterwave.references.length).toBe(1);
  await expect(page.getByRole("status").filter({ hasText: /added|Still confirming/ }).first()).toBeVisible({ timeout: 30_000 });
  await expireSession(page);
  await page.goto(`${accountPath}/billing`);
  await expect(page).toHaveURL(/\/login/);
});

test("dark mode renders", async ({ page }, testInfo) => {
  await logInWithZudomartAccount(page, advertiser.email);
  await page.goto("/accounts");
  await toggleDarkModeOnce(page, testInfo, "ads-accounts", page.getByLabel(/^Signed in as/));
});
