import type { Page, Response } from "@playwright/test";

export interface PageProblems {
  readonly consoleErrors: string[];
  readonly serverErrors: string[];
}

const ignoredConsolePatterns: readonly RegExp[] = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /\[HMR\]/i,
  /challenges\.cloudflare\.com/i,
  /net::ERR_BLOCKED_BY_CLIENT/i,
  /checkout\.paystack\.test/i,
];

export function watchPage(page: Page, problems: PageProblems): void {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = `${message.text()} @ ${message.location().url}`;
    if (!ignoredConsolePatterns.some((pattern) => pattern.test(text))) problems.consoleErrors.push(text);
  });
  page.on("pageerror", (error) => problems.consoleErrors.push(`uncaught: ${error.message}`));
  page.on("response", (response: Response) => {
    if (response.status() >= 500) problems.serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
}

const unreadablePatterns: readonly RegExp[] = [
  /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/,
  /\b(?:TypeError|ReferenceError|SyntaxError|Unhandled|stack trace|ECONNREFUSED|fetch failed)\b/i,
  /\bat [\w.]+ \(.*:\d+:\d+\)/,
  /[{[]\s*"[a-zA-Z]+"\s*:/,
  /\b(?:undefined|null|NaN|\[object Object\])\b/,
  /Internal Server Error|status code \d{3}|\b5\d\d\b/i,
];

export function describeUnreadableMessage(text: string | undefined): string | undefined {
  const trimmed = (text ?? "").trim();
  if (trimmed === "") return undefined;
  const hit = unreadablePatterns.find((pattern) => pattern.test(trimmed));
  return hit === undefined ? undefined : `"${trimmed.slice(0, 200)}" matches ${hit}`;
}

export async function collectUnreadableMessages(page: Page): Promise<string[]> {
  if (page.isClosed()) return [];
  const texts = await page.locator('[role="alert"], [role="status"], [aria-live="assertive"], [data-sonner-toast], .toast, [class*="error" i]').allInnerTexts().catch(() => [] as string[]);
  return texts.map((text) => describeUnreadableMessage(text)).filter((value): value is string => value !== undefined);
}
