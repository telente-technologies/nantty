import { createPublicPost } from "../../src/data/commerce.data.js";
import { doubleClickSubmit, expireSession, malformedInputs, oversizedText } from "../../src/helpers/abuse.helper.js";
import { expectReadableMessages } from "../../src/helpers/rendering.helper.js";
import { toggleDarkModeOnce } from "../../src/helpers/theme.helper.js";
import { enterSignupCode, finishTopicsStep, freshEmail, logInThroughLoginPage, readLatestSignupCode, signUpThroughUi, type BrowserAccount } from "../../src/helpers/webappAuth.helper.js";
import { createSamplePng, registerUser, waitFor } from "../../src/smokeBridge.js";
import { expect, test } from "../../src/test.js";

test.describe.configure({ mode: "serial" });
test.use({ guardOptions: { allowConsoleErrors: [/status of 400 .*\/bff\/api\/v1\/auth\/otp\/verify/, /status of 40[01] .*\/bff\/auth\/login/, /status of 4\d\d .*\/bff\/api\/v1\/users\/me\/profile/, /status of 401 .*\/bff\/api\/v1\/chat\/keys\/devices\//], allowServerErrors: [] } });

let account: BrowserAccount;

test("sign-up: wrong code, resend, refresh mid-flow, then a real code", async ({ page }) => {
  const email = freshEmail("reg");
  await page.goto("/signup");
  await expect(page.getByText(/phone/i), "no phone sign-up option").toHaveCount(0);
  const send = page.getByRole("button", { name: "Send Code" });
  for (const bad of ["", "not-an-email", "a@b", malformedInputs[0] ?? "<x>"]) {
    await page.getByPlaceholder("Enter your email").fill(bad);
    await expect(send, `"${bad}" cannot be submitted`).toBeDisabled();
  }
  await page.getByPlaceholder("Enter your email").fill(email);
  const sends = await doubleClickSubmit(page, send, /\/bff\/.*otp/);
  expect(sends, "double-clicking Send Code sends one code").toBeLessThanOrEqual(1);
  await expect(page.getByRole("heading", { name: "Enter 6-digit code" })).toBeVisible();
  const firstCode = await readLatestSignupCode(email);
  await enterSignupCode(page, firstCode === "000000" ? "111111" : "000000");
  await expect(page.getByRole("alert")).toBeVisible();
  await expectReadableMessages(page);
  await expect(page.getByRole("button", { name: /^Resend code \d+s$/ })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("heading", { name: /email/i }), "refresh restarts the flow cleanly").toBeVisible();
  await page.getByPlaceholder("Enter your email").fill(email);
  await page.getByRole("button", { name: "Send Code" }).click();
  const secondCode = await waitFor(async () => {
    const latest = await readLatestSignupCode(email);
    return latest !== firstCode ? latest : undefined;
  }, 15_000, 500);
  await enterSignupCode(page, secondCode ?? (await readLatestSignupCode(email)));
  await expect(page.getByRole("heading", { name: /birthday/i })).toBeVisible();
  await page.getByLabel("Birthday").pressSequentially("31022000");
  await expect(page.getByText("Enter a real date, like 27/10/2000.")).toBeVisible();
  await page.getByLabel("Birthday").fill("");
  await page.getByLabel("Birthday").pressSequentially(`0101${new Date().getFullYear() - 8}`);
  await expect(page.getByText(/You must be at least \d+ years old/)).toBeVisible();
  await page.getByLabel("Birthday").fill("");
  await page.getByLabel("Birthday").pressSequentially("17051994");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("short");
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.getByLabel("Password", { exact: true }).fill("Sm0ke-Test-Pass!2026");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const taken = await registerUser("taken");
  await page.getByRole("textbox", { name: "Username" }).fill(taken.username.slice(0, 20));
  await expect(page.getByText(/taken|isn.t available|not available/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Username" }).fill("admin");
  await expect(page.getByText(/reserved/i).first()).toBeVisible();
  await page.getByRole("textbox", { name: "Username" }).fill("bad name!!");
  await expect(page.getByRole("button", { name: "Confirm" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Username" }).fill(`e2e${Date.now().toString(36)}`.slice(0, 20));
  await expect(page.getByRole("button", { name: "Confirm" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("heading", { name: "Personalize your feed" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Create username" }), "back after registering does not re-register").toHaveCount(0);
});

test("full sign-up and onboarding topics", async ({ page }) => {
  account = await signUpThroughUi(page, "reg");
  await finishTopicsStep(page);
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  await page.goto("/signup");
  await expect(page, "signed-in users are bounced from sign-up").not.toHaveURL(/\/signup/);
});

test("email-only login, wrong password, and no phone anywhere", async ({ page }) => {
  test.skip(account === undefined, "needs the account");
  await page.goto("/login");
  await expect(page.getByText(/phone/i)).toHaveCount(0);
  await expect(page.locator('input[type="tel"]')).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill("Wrong-Pass-2026!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expectReadableMessages(page);
  await page.getByLabel("Email", { exact: true }).fill(oversizedText.slice(0, 5000));
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expectReadableMessages(page);
  await logInThroughLoginPage(page, account.email, account.password);
  await page.goto("/forgot-password");
  await expect(page.locator('input[type="tel"]')).toHaveCount(0);
});

test("settings: theme, privacy consents survive a reload", async ({ page }, testInfo) => {
  test.skip(account === undefined, "needs the account");
  await logInThroughLoginPage(page, account.email, account.password);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await toggleDarkModeOnce(page, testInfo, "webapp-settings");
  await page.goto("/settings/privacy");
  const analytics = page.getByRole("switch", { name: "Analytics" });
  const before = await analytics.getAttribute("aria-checked");
  await analytics.click();
  await expect(analytics).not.toHaveAttribute("aria-checked", before ?? "");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Analytics" }), "consent choice is saved server side").not.toHaveAttribute("aria-checked", before ?? "");
  await expectReadableMessages(page);
});

test("profile edit is reachable from settings", async ({ page }) => {
  test.fixme(true, "Needs a product decision: the web has no profile editor. The 'Edit profile' button was removed on 2026-10-03 (it only linked to /settings), and users.service.updateMyProfileDetails has no UI.");
  test.skip(account === undefined, "needs the account");
  await logInThroughLoginPage(page, account.email, account.password);
  await page.goto("/settings");
  await page.getByRole("navigation", { name: "More settings" }).getByRole("link", { name: "Profile" }).click();
  await page.getByRole("button", { name: /Edit profile/i }).or(page.getByRole("link", { name: /Edit profile/i })).first().click();
  await page.getByLabel(/^(Name|Display name)$/).fill(oversizedText.slice(0, 500));
  await page.getByRole("button", { name: /^Save/ }).click();
  await expectReadableMessages(page);
  await page.getByLabel(/^(Name|Display name)$/).fill("E2E Person");
  await page.getByLabel(/^Bio$/).fill(malformedInputs[0] ?? "");
  await page.getByRole("button", { name: /^Save/ }).click();
  await page.reload();
  await expect(page.getByText("E2E Person").first()).toBeVisible();
});

test("post with media, then like, reply, repost, share and report", async ({ page }) => {
  test.skip(true, "Posting is app-only on the web by design: there is no composer, and the profile tells users to share from the app.");
  test.skip(account === undefined, "needs the account");
  await logInThroughLoginPage(page, account.email, account.password);
  await page.goto("/");
  await page.getByRole("button", { name: /^(Create|New post|Post)$/ }).or(page.getByRole("link", { name: /^(Create|New post)$/ })).first().click();
  const composer = page.getByRole("dialog").last();
  await composer.locator('input[type="file"]').setInputFiles({ name: "e2e.png", mimeType: "image/png", buffer: createSamplePng() });
  await composer.getByRole("textbox").first().fill("E2E post with media");
  await composer.getByRole("button", { name: /^Post$/ }).click();
  await expect(page.getByText("E2E post with media").first()).toBeVisible();
});

test("interact with someone else's post: like, reply, repost, share, report, follow", async ({ page }) => {
  test.skip(account === undefined, "needs the account");
  const author = await registerUser("author");
  const postId = await createPublicPost(author, "E2E post to interact with");
  await logInThroughLoginPage(page, account.email, account.password);
  await page.goto(`/post/${postId}`);
  const like = page.getByRole("button", { name: /^Like, \d+ likes?/ }).first();
  const likeRequests = await doubleClickSubmit(page, like, /\/likes?$/);
  expect(likeRequests, "double-tapping like does not double-count").toBeLessThanOrEqual(2);
  await page.reload();
  await expect(page.getByRole("button", { name: /^(Unlike|Like), 1 like$/ }).first(), "like count is exactly one").toBeVisible();
  const reply = page.getByRole("combobox", { name: /Post your reply/ }).or(page.getByRole("textbox", { name: /Post your reply/ })).first();
  await reply.fill("   ");
  await expect(page.getByRole("button", { name: "Reply", exact: true })).toBeDisabled();
  await reply.fill(`${malformedInputs[0]} reply`);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(page.getByText("<script>alert(1)</script> reply").first(), "markup is shown as text").toBeVisible();
  await page.getByRole("button", { name: /^Repost( or quote)?, \d+ reposts?/ }).first().click();
  const repostSheet = page.getByRole("dialog", { name: "Repost" });
  await repostSheet.getByRole("button", { name: /^Repost\b/ }).click();
  await expect(page.getByRole("button", { name: /^Reposted, 1 repost/ }).first(), "the repost lands once").toBeVisible();
  if (await repostSheet.isVisible()) await page.keyboard.press("Escape");
  await expect(repostSheet).toBeHidden();
  await page.getByRole("button", { name: "Send in chat" }).first().click();
  await expect(page.getByRole("dialog", { name: "Send in chat" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "More options" }).first().click();
  await page.getByRole("menuitem", { name: "Report", exact: true }).click();
  const report = page.getByRole("dialog", { name: /^Report this/ });
  await expect(report.getByRole("button", { name: "Send report" })).toBeDisabled();
  await report.getByRole("radio", { name: "Spam or misleading" }).check();
  await report.getByLabel("Anything else we should know? (optional)").fill(oversizedText.slice(0, 3000));
  await report.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText(/Report sent|too long|shorter/i).first()).toBeVisible();
  await expectReadableMessages(page);
  await page.goto(`/${author.username}`);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(page.getByRole("button", { name: "Following", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Following", exact: true }), "follow persists").toBeVisible();
});

test("notifications, then sign out and an expired session", async ({ page }) => {
  test.skip(account === undefined, "needs the account");
  await logInThroughLoginPage(page, account.email, account.password);
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expireSession(page);
  await page.goto("/notifications");
  await expect(page).toHaveURL(/\/login\?next=%2Fnotifications/);
  await logInThroughLoginPage(page, account.email, account.password, "/notifications");
  await expect(page).toHaveURL(/\/notifications$/);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).or(page.getByRole("button", { name: "Sign out" })).first().click();
  await page.getByRole("alertdialog", { name: "Sign out of Nantty?" }).getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goBack();
  await expect(page, "back after sign-out does not show member pages").toHaveURL(/\/login/);
});
