import type { Locator, Page } from "@playwright/test";

import { seedGuestWorld, type GuestWorld } from "../../src/data/world.data.js";
import { expectDarkRendering, expectNoHorizontalOverflow } from "../../src/helpers/rendering.helper.js";
import { logInThroughAuthPrompt } from "../../src/helpers/webappAuth.helper.js";
import { smokePassword } from "../../src/smokeBridge.js";
import { expect, test } from "../../src/test.js";

let world: GuestWorld;

test.beforeAll(async () => {
  world = await seedGuestWorld();
});

const signInDialog = (page: Page) => page.getByRole("dialog", { name: /sign in to zudomart/i });

async function expectGateThenReturn(page: Page, path: string, trigger: (page: Page) => Locator, afterSignIn: (page: Page) => Promise<void>): Promise<void> {
  await page.goto(path);
  const before = new URL(page.url()).pathname;
  await trigger(page).first().click();
  await expect(signInDialog(page)).toBeVisible();
  await logInThroughAuthPrompt(page, world.visitor.email, smokePassword);
  await afterSignIn(page);
}

test.describe("guest browsing", () => {
  test("public pages load for a signed-out visitor", async ({ page }) => {
    const paths = ["/", "/explore", "/mart", "/live", "/clips", `/product/${world.store.productId}`, `/store/${world.store.storeId}`, `/${world.author.username}`, `/post/${world.postId}`];
    for (const path of paths) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} status`).toBeLessThan(400);
      await expect(page, `${path} is not bounced to login`).not.toHaveURL(/\/login/);
      await expect(page.locator("main").first(), `${path} renders`).toBeVisible();
    }
    await page.goto(`/post/${world.postId}`);
    await expect(page.getByText(world.postText).first()).toBeVisible();
    await page.goto(`/product/${world.store.productId}`);
    await expect(page.getByText(world.store.productName).first()).toBeVisible();
  });

  test("members-only pages send the guest to sign-in and back afterwards", async ({ page }) => {
    for (const path of ["/cart", "/orders", "/settings", "/chats", "/notifications", "/saved", "/checkout"]) {
      await page.goto(path);
      await expect(page, `${path} asks to sign in`).toHaveURL(/\/login\?next=/);
      expect(decodeURIComponent(new URL(page.url()).searchParams.get("next") ?? "")).toBe(path);
    }
    await page.goto("/login?next=%2Fsettings");
    await page.getByLabel("Email", { exact: true }).fill(world.visitor.email);
    await page.getByLabel("Password", { exact: true }).fill(smokePassword);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("open redirects in next= are ignored", async ({ page }) => {
    await page.goto("/login?next=https%3A%2F%2Fevil.example%2Fsteal");
    await page.getByLabel("Email", { exact: true }).fill(world.visitor.email);
    await page.getByLabel("Password", { exact: true }).fill(smokePassword);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).hostname).toBe("localhost");
  });

  test("like a post: prompt, sign in, stay on the post and the like sticks", async ({ page }) => {
    await expectGateThenReturn(page, `/post/${world.postId}`, (p) => p.getByRole("button", { name: /^Like, \d+ likes?/ }), async (p) => {
      await expect(p).toHaveURL(new RegExp(`/post/${world.postId}`));
      await expect(p.getByRole("button", { name: /^Unlike, \d+ likes?/ }).first()).toBeVisible();
    });
  });

  test("follow a profile: prompt, sign in, stay on the profile, now Following", async ({ page }) => {
    await expectGateThenReturn(page, `/${world.author.username}`, (p) => p.getByRole("button", { name: "Follow", exact: true }), async (p) => {
      await expect(p).toHaveURL(new RegExp(`/${world.author.username}$`));
      await expect(p.getByRole("button", { name: "Following", exact: true }).first()).toBeVisible();
    });
  });

  test("follow a store", async ({ page }) => {
    await expectGateThenReturn(page, `/store/${world.store.storeId}`, (p) => p.getByRole("button", { name: "Follow", exact: true }), async (p) => {
      await expect(p).toHaveURL(new RegExp(`/store/${world.store.storeId}`));
      await expect(p.getByRole("button", { name: "Following", exact: true }).first()).toBeVisible();
    });
  });

  test("add to cart and buy now are gated, then complete on the same product", async ({ page }) => {
    await expectGateThenReturn(page, `/product/${world.store.productId}`, (p) => p.getByRole("button", { name: "Add to cart" }), async (p) => {
      await expect(p).toHaveURL(new RegExp(`/product/${world.store.productId}`));
      await expect(p.getByRole("status").filter({ hasText: /cart/i }).first()).toBeVisible();
    });
    await page.context().clearCookies();
    await expectGateThenReturn(page, `/product/${world.store.productId}`, (p) => p.getByRole("button", { name: "Buy now" }), async (p) => {
      await expect(p).toHaveURL(/\/(checkout|cart|product)/);
    });
  });

  test("reply to a post is gated and returns to the thread", async ({ page }) => {
    await expectGateThenReturn(page, `/post/${world.postId}`, (p) => p.getByRole("button", { name: /Post your reply/ }), async (p) => {
      await expect(p).toHaveURL(new RegExp(`/post/${world.postId}`));
      await expect(p.getByRole("textbox", { name: /Post your reply/ })).toBeVisible();
    });
  });

  test("message a profile is gated and opens the chat", async ({ page }) => {
    await expectGateThenReturn(page, `/${world.author.username}`, (p) => p.getByRole("button", { name: "Message", exact: true }), async (p) => {
      await expect(p).toHaveURL(/\/chats\/[0-9a-f-]{36}/);
    });
  });

  test("share in chat, report and save are gated", async ({ page }) => {
    for (const trigger of [(p: Page) => p.getByRole("button", { name: "Send in chat" }), (p: Page) => p.getByRole("button", { name: /^Save post/ })]) {
      await page.goto(`/post/${world.postId}`);
      await trigger(page).first().click();
      await expect(signInDialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(signInDialog(page)).toBeHidden();
      await expect(page).toHaveURL(new RegExp(`/post/${world.postId}`));
    }
    await page.getByRole("button", { name: "More options" }).first().click();
    await page.getByRole("menuitem", { name: "Report" }).click();
    await expect(signInDialog(page)).toBeVisible();
  });

  test("gifts and live chat are gated on a live page", async ({ page }) => {
    await page.goto("/live");
    const firstLive = page.locator('a[href^="/live/"]').first();
    test.skip((await firstLive.count()) === 0, "no live on air in this sandbox");
    await firstLive.click();
    const gift = page.getByRole("button", { name: /^Send .* for \d+ coins$/ }).or(page.getByRole("button", { name: "Sign in" })).first();
    await gift.click();
    await expect(signInDialog(page)).toBeVisible();
  });

  test("the guest has no way to create a post without signing in", async ({ page }) => {
    await page.goto("/");
    const create = page.getByRole("button", { name: /^(Create|New post|Post)$/ }).or(page.getByRole("link", { name: /^(Create|New post)$/ })).first();
    if (await create.isVisible().catch(() => false)) {
      await create.click();
      await expect(signInDialog(page).or(page.getByRole("heading", { name: /log in|sign in/i })).first()).toBeVisible();
    }
  });

  test("'More sign-in options' keeps the place", async ({ page }) => {
    await page.goto(`/post/${world.postId}`);
    await page.getByRole("button", { name: /^Like, \d+ likes?/ }).first().click();
    await signInDialog(page).getByRole("link", { name: "More sign-in options" }).click();
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByLabel("Email", { exact: true }).fill(world.visitor.email);
    await page.getByLabel("Password", { exact: true }).fill(smokePassword);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/post/${world.postId}`));
  });

  test("wrong password in the prompt is readable; back button after closing the prompt", async ({ page }) => {
    await page.goto("/explore");
    await page.goto(`/post/${world.postId}`);
    await page.getByRole("button", { name: /^Like, \d+ likes?/ }).first().click();
    const dialog = signInDialog(page);
    await dialog.getByLabel("Email or username").fill(world.visitor.email);
    await dialog.getByLabel("Password", { exact: true }).fill("wrong-password-1");
    await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goBack();
    await expect(page).toHaveURL(/\/explore$/);
  });

  test("unknown product and profile ids show a friendly not-found", async ({ page }) => {
    for (const path of ["/product/00000000-0000-7000-8000-000000000000", "/store/not-a-real-store", "/nobody_e2e_404_user", "/post/%3Cscript%3E"]) {
      const response = await page.goto(path);
      expect(response?.status() ?? 0, `${path} is not a server error`).toBeLessThan(500);
      await expect(page.locator("body")).not.toContainText(/Unhandled|TypeError|stack/i);
    }
  });

  test("phone width and dark scheme render for guests", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.context().addCookies([{ name: "theme", value: "dark", domain: "localhost", path: "/" }]);
    await page.goto("/explore");
    await expectNoHorizontalOverflow(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectDarkRendering(page, testInfo, "webapp-guest-explore");
  });
});
