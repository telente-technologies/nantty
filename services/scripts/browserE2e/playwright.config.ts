import { existsSync } from "node:fs";

import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";

import { appUrl, type AppName } from "./src/environment.js";

const runLabel = process.env["E2E_APP"] ?? "adhoc";
const apps: readonly AppName[] = ["webapp", "web", "studio", "seller", "ads", "admin"];

function browserLaunch(): NonNullable<PlaywrightTestConfig["use"]> {
  const choice = process.env["E2E_BROWSER"] ?? "chromium";
  if (choice === "chrome") return { channel: "chrome" };
  const executablePath = process.env["E2E_BROWSER_PATH"] ?? "/usr/bin/chromium";
  if (!existsSync(executablePath)) return { channel: "chrome" };
  return { launchOptions: { executablePath } };
}

export default defineConfig({
  testDir: "./specs",
  outputDir: `./reports/${runLabel}/test-results`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: `./reports/${runLabel}/html`, open: "never" }], ["json", { outputFile: `./reports/${runLabel}/results.json` }]],
  use: {
    ...browserLaunch(),
    headless: process.env["E2E_HEADED"] !== "1",
    viewport: { width: 1366, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    actionTimeout: 20_000,
    navigationTimeout: 180_000,
    locale: "en-NG",
    timezoneId: "Africa/Lagos",
  },
  projects: apps.map((app) => ({ name: app, testDir: `./specs/${app}`, use: { baseURL: appUrl(app) } })),
});
