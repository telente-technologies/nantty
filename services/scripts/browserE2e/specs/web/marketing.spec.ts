import { toggleDarkModeOnce } from "../../src/helpers/theme.helper.js";
import { expectNoHorizontalOverflow } from "../../src/helpers/rendering.helper.js";
import { expect, test } from "../../src/test.js";

const pages = ["/", "/about", "/contact", "/sellers", "/privacy", "/cookies", "/terms", "/community-guidelines", "/seller-terms", "/creator-terms", "/ads-policy", "/refund-escrow-policy", "/copyright-policy", "/data-rights"];

test.describe("guest on the marketing site", () => {
  test("every page loads and has no waitlist", async ({ page }) => {
    for (const path of pages) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} status`).toBeLessThan(400);
      await expect(page.locator("h1").first(), `${path} has a heading`).toBeVisible();
      await expect(page.getByText(/wait\s*-?\s*list/i), `${path} has no waitlist`).toHaveCount(0);
      await expect(page.locator('input[type="email"]'), `${path} collects no emails`).toHaveCount(0);
    }
  });

  test("header, footer and anchor links all resolve", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = new Set<string>();
    for (const scope of [page.getByRole("navigation", { name: "Main" }), page.getByRole("navigation", { name: "Footer" })]) {
      for (const href of await scope.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href))) hrefs.add(href);
    }
    expect(hrefs.size).toBeGreaterThan(10);
    const origin = new URL(page.url()).origin;
    for (const href of hrefs) {
      const target = new URL(href);
      if (target.origin !== origin) {
        expect(href, "external business links point at Zudomart apps").toMatch(/localhost:(3200|3300|3500)|zudomart\.com|apps\.apple\.com|play\.google\.com/);
        continue;
      }
      const response = await request.get(`${target.pathname}${target.search}`);
      expect(response.status(), `${href} resolves`).toBeLessThan(400);
      if (target.hash !== "") {
        await page.goto(`${target.pathname}${target.hash}`);
        await expect(page.locator(target.hash), `${href} anchor exists`).toHaveCount(1);
      }
    }
  });

  test("for-business menu opens and external links open in a new tab", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "For business" });
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Sell on Zudomart" }).first()).toBeVisible();
    const dashboard = page.getByRole("link", { name: /Zudomart Dashboard/ }).first();
    await expect(dashboard).toHaveAttribute("target", "_blank");
    await page.keyboard.press("Escape");
  });

  test("mobile width has no horizontal scroll and the menu toggles", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden();
  });

  test("dark mode renders", async ({ page }, testInfo) => {
    await page.goto("/");
    await toggleDarkModeOnce(page, testInfo, "web-home");
  });
});

test.describe("guest who mistypes a URL", () => {
  test.use({ guardOptions: { allowConsoleErrors: [/status of 404 .*this-page-does-not-exist-e2e/], allowServerErrors: [] } });
  test("unknown path shows a friendly 404 and the back button works", async ({ page }) => {
    await page.goto("/about");
    const missing = await page.goto("/this-page-does-not-exist-e2e");
    expect(missing?.status()).toBe(404);
    await expect(page.locator("body")).not.toContainText(/stack|Error:/);
    await page.goBack();
    await expect(page).toHaveURL(/\/about$/);
  });

});

test.describe("cookie banner", () => {
  test.use({ presetConsent: false });
  test("first visit asks for cookie choices and remembers them", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Your privacy choices" }) });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Reject optional" }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your privacy choices" })).toBeHidden();
  });
});
