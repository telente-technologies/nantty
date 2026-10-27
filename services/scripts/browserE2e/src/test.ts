import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

import { collectUnreadableMessages, watchPage, type PageProblems } from "./pageGuard.js";

export interface GuardOptions {
  readonly allowConsoleErrors: readonly RegExp[];
  readonly allowServerErrors: readonly RegExp[];
}

export async function presetConsentCookie(context: BrowserContext): Promise<void> {
  const choice = { policyVersion: "1.0", decidedAt: new Date().toISOString(), categories: { analytics: false, personalization: true, advertising: false } };
  await context.addCookies([{ name: "nantty_consent", value: encodeURIComponent(JSON.stringify(choice)), domain: "localhost", path: "/", sameSite: "Lax" }]);
}

interface GuardFixtures {
  presetConsent: boolean;
  guardOptions: GuardOptions;
  problems: PageProblems;
  watch: (page: Page) => void;
}

export const test = base.extend<GuardFixtures>({
  guardOptions: [{ allowConsoleErrors: [], allowServerErrors: [] }, { option: true }],
  presetConsent: [true, { option: true }],
  problems: async ({}, use) => {
    await use({ consoleErrors: [], serverErrors: [] });
  },
  watch: async ({ problems }, use) => {
    await use((page) => watchPage(page, problems));
  },
  page: async ({ page, problems, guardOptions, context, presetConsent }, use, testInfo) => {
    if (presetConsent) await presetConsentCookie(context);
    watchPage(page, problems);
    context.on("page", (opened) => {
      if (opened !== page) watchPage(opened, problems);
    });
    await use(page);
    const unreadable = await collectUnreadableMessages(page);
    const consoleErrors = problems.consoleErrors.filter((line) => !guardOptions.allowConsoleErrors.some((pattern) => pattern.test(line)));
    const serverErrors = problems.serverErrors.filter((line) => !guardOptions.allowServerErrors.some((pattern) => pattern.test(line)));
    const summary = [...serverErrors.map((line) => `5xx: ${line}`), ...consoleErrors.map((line) => `console: ${line}`), ...unreadable.map((line) => `unreadable message: ${line}`)];
    if (summary.length > 0) await testInfo.attach("page-problems.txt", { body: summary.join("\n"), contentType: "text/plain" });
    if (testInfo.status === testInfo.expectedStatus) {
      expect.soft(serverErrors, "no 5xx responses").toEqual([]);
      expect.soft(consoleErrors, "no console errors").toEqual([]);
      expect.soft(unreadable, "user-facing messages are human-readable").toEqual([]);
    }
  },
});

export { expect };
