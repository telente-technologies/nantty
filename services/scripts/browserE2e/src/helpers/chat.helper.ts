import { expect, type Page, type Request, type Response } from "@playwright/test";

export interface PlaintextLeakWatch {
  readonly leaks: string[];
  readonly secrets: Set<string>;
}

export function watchForPlaintext(page: Page, watch: PlaintextLeakWatch): void {
  const isChatTraffic = (url: string) => /\/(conversations|messages|chat)\b/.test(url);
  page.on("request", (request: Request) => {
    if (!isChatTraffic(request.url())) return;
    const body = request.postData() ?? "";
    for (const secret of watch.secrets) if (body.includes(secret)) watch.leaks.push(`request ${request.method()} ${request.url()} carries "${secret}"`);
  });
  page.on("response", async (response: Response) => {
    if (!isChatTraffic(response.url())) return;
    const body = await response.text().catch(() => "");
    for (const secret of watch.secrets) if (body.includes(secret)) watch.leaks.push(`response ${response.status()} ${response.url()} carries "${secret}"`);
  });
  page.on("websocket", (socket) => {
    socket.on("framesent", (frame) => {
      for (const secret of watch.secrets) if (String(frame.payload).includes(secret)) watch.leaks.push(`websocket frame sent carries "${secret}"`);
    });
    socket.on("framereceived", (frame) => {
      for (const secret of watch.secrets) if (String(frame.payload).includes(secret)) watch.leaks.push(`websocket frame received carries "${secret}"`);
    });
  });
}

export function looksLikeCiphertext(value: string): boolean {
  if (value.length < 24) return false;
  if (/\s/.test(value.trim())) return false;
  return /^[A-Za-z0-9+/=_-]+$/.test(value) || /^\{"(v|version|type|body|ciphertext)"/.test(value);
}

export async function sendChatMessage(page: Page, text: string): Promise<void> {
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(text, { exact: true }).last()).toBeVisible();
}

export function conversationIdFrom(page: Page): string {
  const match = /\/chats\/([0-9a-f-]{36})/.exec(page.url());
  if (match?.[1] === undefined) throw new Error(`not on a conversation page: ${page.url()}`);
  return match[1];
}
