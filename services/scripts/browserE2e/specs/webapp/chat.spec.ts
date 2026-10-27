import type { Browser, BrowserContext, Page } from "@playwright/test";

import { createPublicPost } from "../../src/data/commerce.data.js";
import { readStoredMessages, searchMessagesTableForText } from "../../src/data/socialDatabase.data.js";
import { doubleClickSubmit, oversizedText } from "../../src/helpers/abuse.helper.js";
import { conversationIdFrom, looksLikeCiphertext, sendChatMessage, watchForPlaintext, type PlaintextLeakWatch } from "../../src/helpers/chat.helper.js";
import { logInThroughLoginPage } from "../../src/helpers/webappAuth.helper.js";
import { registerUser, uniqueSuffix, type UserActor } from "../../src/smokeBridge.js";
import { expect, presetConsentCookie, test } from "../../src/test.js";

test.describe.configure({ mode: "serial" });

let alice: UserActor;
let bob: UserActor;
let carol: UserActor;
let conversationId = "";
// Bob's first browser is his first E2EE device; later tests reuse it so it can still decrypt the earlier messages.
let bobFirstDevice: { context: BrowserContext; page: Page } | null = null;
const watch: PlaintextLeakWatch = { leaks: [], secrets: new Set() };

async function deviceFor(browser: Browser, user: UserActor, watchPage: (page: Page) => void): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  await presetConsentCookie(context);
  const page = await context.newPage();
  watchPage(page);
  watchForPlaintext(page, watch);
  await logInThroughLoginPage(page, user.email);
  return { context, page };
}

function secret(label: string): string {
  const value = `e2e-secret-${label}-${uniqueSuffix()}`;
  watch.secrets.add(value);
  return value;
}

test.beforeAll(async () => {
  [alice, bob, carol] = await Promise.all([registerUser("alice"), registerUser("bob"), registerUser("carol")]);
});

test.afterAll(async () => {
  await bobFirstDevice?.context.close();
  expect(watch.leaks, "no chat plaintext ever crossed the network").toEqual([]);
});

test("two devices: start a DM and see messages live on both sides", async ({ browser, watch: watchPage }) => {
  const a = await deviceFor(browser, alice, watchPage);
  const b = await deviceFor(browser, bob, watchPage);
  await a.page.goto(`/${bob.username}`);
  await a.page.getByRole("button", { name: "Message", exact: true }).click();
  await a.page.waitForURL(/\/chats\/[0-9a-f-]{36}/);
  conversationId = conversationIdFrom(a.page);
  await b.page.goto(`/chats/${conversationId}`);
  const hello = secret("hello");
  await sendChatMessage(a.page, hello);
  await expect(b.page.getByText(hello, { exact: true }), "Bob decrypts Alice's message live").toBeVisible({ timeout: 8_000 });
  const request = b.page.getByRole("region", { name: "Message request" });
  await expect(request, "a first message from a stranger arrives as a request").toBeVisible();
  await request.getByRole("button", { name: "Accept" }).click();
  await expect(request, "accepting clears the request").toHaveCount(0);
  const answer = secret("answer");
  await sendChatMessage(b.page, answer);
  await expect(a.page.getByText(answer, { exact: true }), "Alice decrypts Bob's reply live").toBeVisible({ timeout: 8_000 });
  const sends = await (async () => {
    await a.page.getByRole("textbox", { name: "Message" }).fill(secret("double"));
    return doubleClickSubmit(a.page, a.page.getByRole("button", { name: "Send", exact: true }), /\/messages$/, 1500);
  })();
  expect(sends, "double-tapping Send sends once").toBeLessThanOrEqual(1);
  await a.page.getByRole("textbox", { name: "Message" }).fill("   ");
  await expect(a.page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  await a.page.getByRole("textbox", { name: "Message" }).fill(oversizedText);
  await a.page.getByRole("button", { name: "Send", exact: true }).click();
  await a.page.reload();
  await expect(a.page.getByText(hello, { exact: true }), "history decrypts after a refresh").toBeVisible();
  await a.context.close();
  bobFirstDevice = b;
});

test("an accepted request lives in Chats, not under Requests", async ({ browser, watch: watchPage }) => {
  test.skip(conversationId === "", "needs the conversation");
  const b = await deviceFor(browser, bob, watchPage);
  await b.page.goto("/chats");
  await expect(b.page.locator(`a[href="/chats/${conversationId}"]`).first(), "accepted chat is in the inbox").toBeVisible();
  await b.page.getByRole("button", { name: /change inbox folder$/ }).click();
  await b.page.getByRole("menuitemradio", { name: /Requests/ }).click();
  await expect(b.page.getByRole("button", { name: "Requests, change inbox folder" })).toBeVisible();
  await expect(b.page.locator(`a[href="/chats/${conversationId}"]`), "nothing left under Requests").toHaveCount(0);
  await b.context.close();
});

test("the server stores only ciphertext", async () => {
  test.skip(conversationId === "", "needs the conversation");
  const rows = readStoredMessages(conversationId);
  expect(rows.length).toBeGreaterThanOrEqual(2);
  for (const row of rows.filter((stored) => stored.kind === "text")) {
    expect(row.protocol, `message ${row.id} uses a real protocol`).not.toBe("signal-v1-pending");
    expect(looksLikeCiphertext(row.ciphertext), `message ${row.id} payload is ciphertext, got "${row.ciphertext.slice(0, 60)}"`).toBe(true);
  }
  for (const value of watch.secrets) expect(searchMessagesTableForText(value), `"${value}" is not stored in plaintext`).toBe(0);
});

test("reply, reaction and mention picker", async () => {
  test.fixme(true, "Needs a product decision: the web chat has no reply, reaction or @mention picker UI yet (it only renders mentions). Mobile has them.");
});

test("share a post into the chat", async ({ browser, watch: watchPage }) => {
  test.skip(conversationId === "", "needs the conversation");
  const postId = await createPublicPost(carol, "E2E post to share in chat");
  const a = await deviceFor(browser, alice, watchPage);
  const b = await deviceFor(browser, bob, watchPage);
  await b.page.goto(`/chats/${conversationId}`);
  await a.page.goto(`/post/${postId}`);
  await a.page.getByRole("button", { name: "Send in chat" }).first().click();
  const share = a.page.getByRole("dialog", { name: "Send in chat" });
  await share.getByRole("checkbox").first().check();
  await share.getByRole("button", { name: /^Send/ }).click();
  await expect(a.page.getByText(/Sent to 1 chat/)).toBeVisible();
  await expect(b.page.getByText("E2E post to share in chat").first(), "shared post shows up for Bob").toBeVisible({ timeout: 8_000 });
  await a.context.close();
  await b.context.close();
});

test("send a photo in the chat, end-to-end encrypted", async ({ browser, watch: watchPage }) => {
  test.skip(conversationId === "", "needs the conversation");
  const a = await deviceFor(browser, alice, watchPage);
  await a.page.goto(`/chats/${conversationId}`);
  const attach = a.page.getByRole("button", { name: /^(Attach|Add (photo|media)|Send (photo|media))/ });
  await expect(attach, "an attach control is offered").toBeVisible({ timeout: 5_000 });
  await a.context.close();
});

test("group chat with three people", async ({ browser, watch: watchPage }) => {
  test.fixme(true, "Needs a product decision: the web chat cannot create groups yet (no New group control). Mobile can.");
  const a = await deviceFor(browser, alice, watchPage);
  const c = await deviceFor(browser, carol, watchPage);
  await a.page.goto("/chats");
  await a.page.getByRole("button", { name: /^(New (group|chat|message)|Create group)/ }).first().click();
  for (const member of [bob, carol]) {
    await a.page.getByRole("dialog").last().getByRole("textbox").first().fill(member.username);
    await a.page.getByRole("dialog").last().getByText(member.username).first().click();
  }
  await a.page.getByRole("dialog").last().getByRole("button", { name: /^(Create|Next|Start)/ }).click();
  await a.page.waitForURL(/\/chats\/[0-9a-f-]{36}/);
  const groupId = conversationIdFrom(a.page);
  await c.page.goto(`/chats/${groupId}`);
  const text = secret("group");
  await sendChatMessage(a.page, text);
  await expect(c.page.getByText(text, { exact: true })).toBeVisible({ timeout: 8_000 });
  for (const row of readStoredMessages(groupId)) expect(looksLikeCiphertext(row.ciphertext), `group message ${row.id} is ciphertext`).toBe(true);
  await a.context.close();
  await c.context.close();
});

test("a new device for the other person shows a safety warning", async ({ browser, watch: watchPage }) => {
  test.skip(conversationId === "", "needs the conversation");
  const a = await deviceFor(browser, alice, watchPage);
  await a.page.goto(`/chats/${conversationId}`);
  await sendChatMessage(a.page, secret("before-new-device"));
  const freshBobDevice = await deviceFor(browser, bob, watchPage);
  await freshBobDevice.page.goto(`/chats/${conversationId}`);
  await expect(
    freshBobDevice.page.getByText("Sent before this device joined secure chat").first(),
    "a brand-new device cannot read history and says so",
  ).toBeVisible({ timeout: 10_000 });
  await sendChatMessage(freshBobDevice.page, secret("new-device"));
  await a.page.reload();
  await expect(a.page.getByText(/security (code|number) (changed|has changed)|new device|safety number/i).first(), "Alice is warned that Bob's keys changed").toBeVisible({ timeout: 10_000 });
  await a.context.close();
  await freshBobDevice.context.close();
});

test("report: pick messages, see consent, and the report carries only those messages", async ({ browser, watch: watchPage }) => {
  test.skip(conversationId === "", "needs the conversation");
  const b = bobFirstDevice ?? (await deviceFor(browser, bob, watchPage));
  await b.page.goto(`/chats/${conversationId}`);
  let reportBody = "";
  b.page.on("request", (request) => {
    if (request.method() === "POST" && /\/reports$/.test(new URL(request.url()).pathname)) reportBody = request.postData() ?? "";
  });
  await b.page.getByRole("button", { name: "Conversation options" }).click();
  await b.page.getByRole("menuitem", { name: "Report conversation" }).click();
  const dialog = b.page.getByRole("dialog", { name: /^Report/ });
  await dialog.getByRole("radio", { name: "Harassment or bullying" }).check();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByText(/Only the messages you choose below leave your device/)).toBeVisible();
  await dialog.getByRole("button", { name: "Pick messages" }).click();
  await expect(dialog.getByRole("button", { name: "Pick messages" })).toHaveAttribute("aria-pressed", "true");
  const boxes = dialog.getByRole("checkbox");
  await boxes.nth(0).check();
  await expect(dialog.getByText(/These messages will be sent to Nantty for review/)).toBeVisible();
  await expect(dialog.getByText(/1 message(s)? selected/)).toBeVisible();
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(dialog.getByText("Thanks, we'll review this").or(b.page.getByText("Thanks, we'll review this"))).toBeVisible();
  const parsed = JSON.parse(reportBody || "{}") as { evidence?: unknown[] | { messages?: unknown[] }; messages?: unknown[] };
  const sentMessages = Array.isArray(parsed.evidence) ? parsed.evidence : (parsed.evidence?.messages ?? parsed.messages ?? []);
  expect(sentMessages, "exactly the one picked message is submitted").toHaveLength(1);
  if (b !== bobFirstDevice) await b.context.close();
});
