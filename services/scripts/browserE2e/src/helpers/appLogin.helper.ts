import { expect, type Page } from "@playwright/test";

import { smokePassword } from "../smokeBridge.js";

export async function logInWithZudomartAccount(page: Page, identifier: string, options: { readonly next?: string; readonly password?: string; readonly identifierLabel?: string | RegExp; readonly submit?: string | RegExp } = {}): Promise<void> {
  await page.goto(options.next === undefined ? "/login" : `/login?next=${encodeURIComponent(options.next)}`);
  await page.getByLabel(options.identifierLabel ?? /^(Email or username|Email)$/).fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(options.password ?? smokePassword);
  await page.getByRole("button", { name: options.submit ?? /^(Sign in|Log in)$/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 });
}

export async function expectRedirectedToLogin(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login(\?|$)/);
  const next = new URL(page.url()).searchParams.get("next");
  if (next !== null) expect(decodeURIComponent(next)).toContain(path.split("?")[0]);
}
