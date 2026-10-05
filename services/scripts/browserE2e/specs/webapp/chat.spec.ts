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

test.afterAll(() => {
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

test("reply, reaction, mention and a shared post", async ({ browser, watch: watchPage }) => {
  test.skip(conversationId === "", "needs the conversation");
  const postId = await createPublicPost(carol, "E2E post to share in chat");
  const a = await deviceFor(browser, alice, watchPage);
  const b = await deviceFor(browser, bob, watchPage);
  await a.page.goto(`/chats/${conversationId}`);
  await b.page.goto(`/chats/${conversationId}`);
  const target = secret("reply-target");
  await sendChatMessage(b.page, target);
  const bubble = a.page.getByText(target, { exact: true });
  await expect(bubble).toBeVisible({ timeout: 8_000 });
  await bubble.hover();
  await a.page.getByRole("button", { name: /^Reply/ }).last().click();
  const replyText = secret("reply");
  await sendChatMessage(a.page, replyText);
  await expect(b.page.getByText(replyText, { exact: true })).toBeVisible({ timeout: 8_000 });
  await expect(b.page.getByText(target).nth(1), "the reply quotes the original").toBeVisible();
  await bubble.hover();
  await a.page.getByRole("button", { name: /^(React|Add reaction)/ }).last().click();
  await a.page.getByRole("button", { name: /❤|heart/i }).first().click();
  await expect(b.page.getByText("❤").first(), "Bob sees the reaction live").toBeVisible({ timeout: 8_000 });
  await a.page.getByRole("textbox", { name: "Message" }).pressSequentially(`hi @${bob.username.slice(0, 4)}`);
  await a.page.getByRole("option", { name: new RegExp(bob.username) }).click();
  await a.page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(b.page.getByRole("link", { name: `@${bob.username}` }).last(), "mention renders as a link").toBeVisible({ timeout: 8_000 });
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

test("group chat with three people", async ({ browser, watch: watchPage }) => {
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
  const freshBobDevice = await deviceFor(browser, bob, watchPage);
  await freshBobDevice.page.goto(`/chats/${conversationId}`);
  await sendChatMessage(freshBobDevice.page, secret("new-device"));
  await a.page.goto(`/chats/${conversationId}`);
  await expect(a.page.getByText(/security (code|number) (changed|has changed)|new device|safety number/i).first(), "Alice is warned that Bob's keys changed").toBeVisible({ timeout: 10_000 });
  await a.context.close();
  await freshBobDevice.context.close();
});

test("report: pick messages, see consent, and the report carries only those messages", async ({ browser, watch: watchPage }) => {
  test.skip(conversationId === "", "needs the conversation");
  const b = await deviceFor(browser, bob, watchPage);
  await b.page.goto(`/chats/${conversationId}`);
  let reportBody = "";
  b.page.on("request", (request) => {
    if (request.method() === "POST" && /\/reports$/.test(new URL(request.url()).pathname)) reportBody = request.postData() ?? "";
  });
  await b.page.getByRole("button", { name: "Conversation options" }).click();
  await b.page.getByRole("menuitem", { name: "Report conversation" }).click();
  const dialog = b.page.getByRole("dialog", { name: /^Report/ });
  await dialog.getByRole("radio", { name: "Harassment or bullying" }).check();
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText(/Only the messages you choose below leave your device/)).toBeVisible();
  await dialog.getByRole("radio", { name: "Pick messages" }).check();
  const boxes = dialog.getByRole("checkbox");
  await boxes.nth(0).check();
  await expect(dialog.getByText(/These messages will be sent to Zudomart for review/)).toBeVisible();
  await expect(dialog.getByText(/1 message(s)? selected/)).toBeVisible();
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(dialog.getByText("Thanks, we'll review this").or(b.page.getByText("Thanks, we'll review this"))).toBeVisible();
  const parsed = JSON.parse(reportBody || "{}") as { evidence?: { messages?: unknown[] }; messages?: unknown[] };
  const sentMessages = parsed.evidence?.messages ?? parsed.messages ?? [];
  expect(sentMessages, "exactly the one picked message is submitted").toHaveLength(1);
  await b.context.close();
});
