import type { Page } from "@playwright/test";

import { bootstrapUnenrolledSuperadmin, freshTotp, seedReservedUsernames, type PendingStaff } from "../../src/data/admin.data.js";
import { corruptSession, doubleClickSubmit, malformedInputs } from "../../src/helpers/abuse.helper.js";
import { expectReadableMessages } from "../../src/helpers/rendering.helper.js";
import { toggleDarkModeOnce } from "../../src/helpers/theme.helper.js";
import { callApi, createSuperadmin, registerUser, uniqueSuffix } from "../../src/smokeBridge.js";
import { expect, test } from "../../src/test.js";

test.describe.configure({ mode: "serial" });
test.use({ guardOptions: { allowConsoleErrors: [/status of 401 .*\/bff\/auth\/(login|mfa\/[a-z-]+|step-up[a-z/-]*)$/, /status of 403 .*\/bff\/admin\/usernames\/reserved$/, /status of 403 .*\/bff\/admin\/users\/[^/]+\/suspend$/], allowServerErrors: [] } });

let staff: PendingStaff;
let totpSecret = "";
let recoveryCodes: string[] = [];

async function passwordStep(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/login\/mfa/);
}

async function signInWithTotp(page: Page): Promise<void> {
  await passwordStep(page, staff.email, staff.password);
  await page.getByLabel("6-digit code").fill(await freshTotp(totpSecret));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

test.beforeAll(() => {
  staff = bootstrapUnenrolledSuperadmin();
});

test("signed-out deep links land on sign-in; wrong password is readable", async ({ page }) => {
  await page.goto("/moderation/reports");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Work email").fill(staff.email);
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expectReadableMessages(page);
  await page.goto("/login/mfa");
  await expect(page).toHaveURL(/\/login(\?|$)/);
});

test("first sign-in enrols MFA and shows recovery codes", async ({ page }) => {
  await passwordStep(page, staff.email, staff.password);
  await expect(page.getByRole("heading", { name: "Set up your authenticator" })).toBeVisible();
  totpSecret = (await page.getByLabel("Setup key").innerText()).replace(/\s/g, "");
  expect(totpSecret).toMatch(/^[A-Z2-7]{16,}$/);
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Turn on two-step verification" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expectReadableMessages(page);
  await page.getByLabel("6-digit code").fill(await freshTotp(totpSecret));
  await page.getByRole("button", { name: "Turn on two-step verification" }).click();
  await expect(page.getByText("Authenticator is set up")).toBeVisible();
  recoveryCodes = (await page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem").allInnerTexts()).map((code) => code.trim());
  expect(recoveryCodes.length).toBeGreaterThanOrEqual(5);
  const proceed = page.getByRole("button", { name: "Continue to the console" });
  await expect(proceed).toBeDisabled();
  await page.getByLabel("I saved my recovery codes").check();
  await proceed.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
});

test("TOTP sign-in, then a recovery code works once only", async ({ page }) => {
  await signInWithTotp(page);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
  await passwordStep(page, staff.email, staff.password);
  await page.getByRole("button", { name: "Lost your phone? Use a recovery code" }).click();
  const code = recoveryCodes[0] ?? "";
  await page.getByLabel("Recovery code").fill(code);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
  await passwordStep(page, staff.email, staff.password);
  await page.getByRole("button", { name: "Lost your phone? Use a recovery code" }).click();
  await page.getByLabel("Recovery code").fill(code);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.getByRole("alert").first(), "a used recovery code is refused").toBeVisible();
  await expect(page).toHaveURL(/\/login\/mfa/);
});

test("reserved usernames: add with step-up, reject malformed, page past the first page, remove", async ({ page }) => {
  const apiStaff = await createSuperadmin();
  const prefix = `e2epg${uniqueSuffix()}`.slice(0, 18);
  await seedReservedUsernames(apiStaff, 55, prefix);
  await signInWithTotp(page);
  await page.goto("/usernames/reserved");
  await expect(page.getByRole("heading", { name: "Reserved usernames" })).toBeVisible();
  await page.getByRole("button", { name: "Reserve a name" }).click();
  const dialog = page.getByRole("dialog", { name: "Reserve a name" });
  for (const bad of ["a", malformedInputs[0] ?? "<x>", "x".repeat(40)]) {
    await dialog.getByLabel("Name").fill(bad);
    const reserveButton = dialog.getByRole("button", { name: "Reserve" });
    if (await reserveButton.isEnabled()) await reserveButton.click();
    await expect(dialog, `"${bad.slice(0, 10)}" is refused`).toBeVisible();
  }
  await expectReadableMessages(page);
  const term = `e2eres${uniqueSuffix()}`.slice(0, 20);
  await dialog.getByLabel("Name").fill(term);
  const reserve = dialog.getByRole("button", { name: "Reserve" });
  const sent = await doubleClickSubmit(page, reserve, /\/bff\/admin\/usernames\/reserved$/, 1000);
  const stepUp = page.getByRole("dialog", { name: "Confirm it's you" });
  if (await stepUp.isVisible().catch(() => false)) {
    await stepUp.getByLabel("Authenticator code").fill("111111");
    await stepUp.getByRole("button", { name: "Confirm" }).click();
    await expect(stepUp.getByRole("alert").first()).toBeVisible();
    await stepUp.getByLabel("Authenticator code").fill(await freshTotp(totpSecret));
    await stepUp.getByRole("button", { name: "Confirm" }).click();
  }
  expect(sent, "double-click reserves at most twice (one retry after step-up)").toBeLessThanOrEqual(2);
  await expect(page.getByText(`Reserved ${term}`)).toBeVisible();
  const firstPage = await page.getByRole("table", { name: "Reserved usernames" }).locator("tbody tr").allInnerTexts();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const secondPage = await page.getByRole("table", { name: "Reserved usernames" }).locator("tbody tr").allInnerTexts();
  expect(secondPage.length).toBeGreaterThan(0);
  expect(secondPage[0]).not.toEqual(firstPage[0]);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByPlaceholder("Search names on this page").fill(term);
  await page.getByRole("button", { name: `Remove ${term}` }).click();
  await page.getByRole("dialog", { name: `Remove ${term}` }).getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText(`Removed ${term}`)).toBeVisible();
});

test("moderation queues load and page beyond the first page", async ({ page }) => {
  await signInWithTotp(page);
  for (const [path, heading, caption] of [["/moderation/reports", "Reports", "Reports queue"], ["/moderation/appeals", "Appeals", "Appeals queue"], ["/moderation/suspensions", "Suspensions", "Suspension cases"], ["/verification", "Verification reviews", "Verification requests"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: caption }).or(page.getByText(/Queue is clear|Nothing|No /).first())).toBeVisible();
    const pager = page.getByRole("navigation", { name: "Pagination" });
    const next = pager.getByRole("button", { name: "Next" });
    if (await next.isVisible().catch(() => false) && await next.isEnabled()) {
      const before = await pager.innerText();
      await next.click();
      await expect(pager).not.toHaveText(before);
    }
    await page.getByRole("searchbox").or(page.getByPlaceholder(/^Search/)).first().fill(malformedInputs[1] ?? "' OR 1=1");
    await page.waitForTimeout(800);
    await expectReadableMessages(page);
  }
  await page.goto("/moderation/suspensions");
  await page.getByRole("tab", { name: "Suspended accounts" }).click();
  await page.getByRole("tab", { name: "Appeals" }).click();
});

test("suspending a user (step-up when asked) signs them out everywhere", async ({ page }) => {
  await signInWithTotp(page);
  const target = await registerUser("susp");
  await page.goto(`/users/${target.accountId}`);
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Suspend user" });
  await expect(confirm.getByRole("button", { name: "Suspend", exact: true }), "an empty reason cannot be submitted").toBeDisabled();
  await confirm.getByLabel(/Reason/).fill("E2E suspension check");
  await confirm.getByRole("button", { name: "Suspend", exact: true }).click();
  const stepUp = page.getByRole("dialog", { name: "Confirm it's you" });
  const suspended = page.getByText("User suspended");
  await expect(stepUp.or(suspended).first()).toBeVisible();
  if (await stepUp.isVisible()) {
    await stepUp.getByLabel("Authenticator code").fill(await freshTotp(totpSecret));
    await stepUp.getByRole("button", { name: "Confirm" }).click();
  }
  await expect(suspended).toBeVisible();
  const profile = await callApi("GET", "/api/v1/users/me", { token: target.accessToken });
  expect(profile.status, "suspended user's token stops working").toBeGreaterThanOrEqual(400);
});

test("a normal Nantty user cannot use the admin console; tampered session is refused", async ({ page }) => {
  const member = await registerUser("notadmin");
  await page.goto("/login");
  await page.getByLabel("Work email").fill(member.email);
  await page.getByLabel("Password", { exact: true }).fill("Sm0ke-Test-Pass!2026");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/login(\?|$)/);
  await signInWithTotp(page);
  await corruptSession(page);
  await page.goto("/overview");
  await expect(page).toHaveURL(/\/login/);
});

test("dark mode renders", async ({ page }, testInfo) => {
  await signInWithTotp(page);
  await page.goto("/overview");
  await toggleDarkModeOnce(page, testInfo, "admin-overview");
});
