import { expect, type Locator, type Page, type Request } from "@playwright/test";

export const oversizedText = "Z".repeat(20_000);
export const malformedInputs: readonly string[] = ["<script>alert(1)</script>", "' OR 1=1 --", "\u0000‮​", "😀".repeat(400), "   "];

export function countRequests(page: Page, matcher: (request: Request) => boolean): { readonly count: () => number; readonly stop: () => void } {
  let total = 0;
  const listener = (request: Request) => {
    if (matcher(request)) total += 1;
  };
  page.on("request", listener);
  return { count: () => total, stop: () => page.off("request", listener) };
}

export function isMutation(pathPattern: RegExp): (request: Request) => boolean {
  return (request) => request.method() !== "GET" && pathPattern.test(new URL(request.url()).pathname);
}

export async function doubleClickSubmit(page: Page, button: Locator, pathPattern: RegExp, settleMs = 2500): Promise<number> {
  const counter = countRequests(page, isMutation(pathPattern));
  await button.evaluate((element: HTMLElement) => {
    element.click();
    element.click();
  });
  await page.waitForTimeout(settleMs);
  counter.stop();
  return counter.count();
}

export async function expectNoScriptInjection(page: Page): Promise<void> {
  let dialogSeen = false;
  page.once("dialog", async (dialog) => {
    dialogSeen = true;
    await dialog.dismiss();
  });
  await page.waitForTimeout(500);
  expect(dialogSeen, "user input was never executed as script").toBe(false);
}

export async function expireSession(page: Page): Promise<void> {
  const cookies = await page.context().cookies();
  await page.context().clearCookies();
  const keep = cookies.filter((cookie) => !/sess|token|auth|sid|access|refresh/i.test(cookie.name));
  if (keep.length > 0) await page.context().addCookies(keep);
}

export async function corruptSession(page: Page): Promise<void> {
  const cookies = await page.context().cookies();
  await page.context().clearCookies();
  await page.context().addCookies(cookies.map((cookie) => (/sess|token|auth|sid|access|refresh/i.test(cookie.name) ? { ...cookie, value: `${cookie.value.slice(0, -6)}XXXXXX` } : cookie)));
}
