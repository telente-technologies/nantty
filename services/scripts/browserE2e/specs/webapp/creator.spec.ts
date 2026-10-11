import { createSubscriptionPlan, promoteToCreator } from "../../src/data/creator.data.js";
import { doubleClickSubmit } from "../../src/helpers/abuse.helper.js";
import { routeFlutterwaveToFake } from "../../src/helpers/flutterwave.helper.js";
import { verifyNigerianUserToLevelOne } from "../../../apiSmoke/src/fakeFlutterwave.util.js";
import { logInThroughLoginPage } from "../../src/helpers/webappAuth.helper.js";
import { callApi, registerUser, uniqueSuffix, waitFor, type UserActor } from "../../src/smokeBridge.js";
import { expect, test } from "../../src/test.js";

test.describe.configure({ mode: "serial" });

let applicant: UserActor;
let creator: UserActor;
let restoreThresholds: (() => Promise<void>) | undefined;
const planName = `E2E Gold ${uniqueSuffix()}`;

test.beforeAll(async () => {
  applicant = await registerUser("applicant");
  creator = await registerUser("creator");
  restoreThresholds = (await promoteToCreator(creator)).restore;
  await verifyNigerianUserToLevelOne(creator);
  await createSubscriptionPlan(creator, planName);
});

test.afterAll(async () => {
  await restoreThresholds?.();
});

test("a non-creator can apply to the Creator Program from the webapp", async ({ page }) => {
  test.fixme(true, "Needs a product decision: the web Creator page tells non-creators to apply in the mobile app (store badges only) and has no web apply action.");
  await logInThroughLoginPage(page, applicant.email);
  await page.goto("/creator");
  await expect(page.getByRole("heading", { name: "Join the Creator Program" })).toBeVisible();
  const apply = page.getByRole("button", { name: /^(Apply|Join|Apply now|Join the Creator Program)$/ }).or(page.getByRole("link", { name: /^(Apply|Apply now)$/ })).first();
  await expect(apply, "the webapp offers an apply action, not only an app download").toBeVisible();
  const sent = await doubleClickSubmit(page, apply, /creator-application|creators\/applications/);
  expect(sent).toBeLessThanOrEqual(1);
  await expect(page.getByText(/application (is )?(sent|in review|pending)|approved/i).first()).toBeVisible();
});

test("creator dashboard loads for an approved creator", async ({ page }) => {
  await logInThroughLoginPage(page, creator.email);
  await page.goto("/creator");
  await expect(page.getByRole("heading", { name: "Creator dashboard" })).toBeVisible();
  for (const period of ["This week", "This month", "All time"]) await page.getByRole("group", { name: "Filter dashboard period" }).getByRole("button", { name: period }).click();
});

test("a fan subscribes to the creator through fake Flutterwave", async ({ page }) => {
  const fan = await registerUser("fan");
  await logInThroughLoginPage(page, fan.email);
  await routeFlutterwaveToFake(page, "/pay/return");
  await page.goto(`/${creator.username}`);
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Subscribe to/ });
  await dialog.getByRole("radio", { name: new RegExp(planName) }).check();
  const go = dialog.getByRole("button", { name: "Continue to checkout" });
  const starts = await doubleClickSubmit(page, go, /\/subscriptions$/, 500);
  expect(starts, "double-tapping checkout starts one subscription").toBeLessThanOrEqual(1);
  await page.waitForURL(/\/subscriptions\/return/, { timeout: 60_000 });
  await expect(page.getByText(/subscribed|active|welcome/i).first()).toBeVisible({ timeout: 30_000 });
  const active = await waitFor(async () => {
    const response = await callApi("GET", "/api/v1/creator-subscriptions", { token: fan.accessToken });
    return JSON.stringify(response.body ?? {}).includes("active") ? true : undefined;
  }, 20_000, 1000);
  expect(active, "the subscription is active after the webhook").toBe(true);
  await page.goto(`/${creator.username}`);
  await expect(page.getByRole("button", { name: /^(Subscribed|Manage subscription)$/ })).toBeVisible();
});
