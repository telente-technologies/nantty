import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

import { expectDarkRendering } from "./rendering.helper.js";

export async function chooseDarkTheme(page: Page, opener?: Locator): Promise<void> {
  if (opener !== undefined && (await opener.isVisible().catch(() => false))) await opener.click();
  const darkRadio = page.getByRole("radio", { name: "Dark", exact: true }).first();
  if (await darkRadio.count() > 0) {
    await darkRadio.check({ force: true });
    return;
  }
  const darkButton = page.getByRole("button", { name: /^dark( mode| theme)?$/i }).first();
  await expect(darkButton, "a Dark theme control is reachable").toBeVisible();
  await darkButton.click();
}

export async function toggleDarkModeOnce(page: Page, testInfo: TestInfo, label: string, opener?: Locator): Promise<void> {
  await chooseDarkTheme(page, opener);
  await expectDarkRendering(page, testInfo, label);
  await page.reload();
  await expectDarkRendering(page, testInfo, `${label}-after-reload`);
}
