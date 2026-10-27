import { expect, type Page } from "@playwright/test";

import { readOneTimeCodeFromIdentityLog, registerUser, smokePassword, uniqueSuffix, type UserActor } from "../smokeBridge.js";

export interface BrowserAccount {
  readonly email: string;
  readonly username: string;
  readonly password: string;
}

export function freshEmail(prefix: string): string {
  return `${prefix}${uniqueSuffix()}@smoke.nantty.test`.toLowerCase();
}

export async function logInThroughLoginPage(page: Page, identifier: string, password = smokePassword, next?: string): Promise<void> {
  await page.goto(next === undefined ? "/login" : `/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

export async function logInThroughAuthPrompt(page: Page, identifier: string, password = smokePassword): Promise<void> {
  const dialog = page.getByRole("dialog", { name: /sign in to nantty/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Email or username").fill(identifier);
  await dialog.getByLabel("Password", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

export async function signedInUser(page: Page, prefix: string): Promise<UserActor> {
  const user = await registerUser(prefix);
  await logInThroughLoginPage(page, user.email);
  return user;
}

export async function enterSignupCode(page: Page, code: string): Promise<void> {
  const input = page.getByLabel("Verification code");
  await input.fill("");
  await input.pressSequentially(code, { delay: 20 });
}

export async function readLatestSignupCode(email: string): Promise<string> {
  return readOneTimeCodeFromIdentityLog(email, "signup");
}

export async function signUpThroughUi(page: Page, prefix: string, options: { readonly username?: string } = {}): Promise<BrowserAccount> {
  const email = freshEmail(prefix);
  await page.goto("/signup");
  await page.getByPlaceholder("Enter your email").fill(email);
  await page.getByRole("button", { name: "Send Code" }).click();
  await expect(page.getByRole("heading", { name: "Enter 6-digit code" })).toBeVisible();
  await enterSignupCode(page, await readLatestSignupCode(email));
  await expect(page.getByRole("heading", { name: /birthday/i })).toBeVisible();
  await page.getByLabel("Birthday").pressSequentially("17051994");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill(smokePassword.slice(0, 20));
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create username" })).toBeVisible();
  const username = options.username ?? `e2e${uniqueSuffix()}`.slice(0, 20);
  await page.getByRole("textbox", { name: "Username" }).fill(username);
  await expect(page.getByRole("button", { name: "Confirm" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("heading", { name: "Personalize your feed" })).toBeVisible({ timeout: 30_000 });
  return { email, username, password: smokePassword.slice(0, 20) };
}

export async function finishTopicsStep(page: Page): Promise<void> {
  const topics = page.getByRole("group", { name: "Choose your interests" }).getByRole("button");
  await expect(topics.first()).toBeVisible({ timeout: 20_000 });
  for (let index = 0; index < 3; index += 1) await topics.nth(index).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/signup"), { timeout: 30_000 });
}
