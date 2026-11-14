import { exportPKCS8, generateKeyPair } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FcmPushSender } from "../src/integrations/fcmPush.integration.js";

afterEach(() => vi.unstubAllGlobals());

async function makeSender(fetcher: typeof fetch) {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  return new FcmPushSender({ projectId: "nantty-test", clientEmail: "push@example.test", privateKey: await exportPKCS8(privateKey) }, fetcher);
}

function fcmFailure(status: string, message = "provider response must not be retained") {
  return new Response(JSON.stringify({ error: { status, message } }), { status: 404, headers: { "content-type": "application/json" } });
}

describe("FcmPushSender", () => {
  it("exchanges a service-account assertion and sends a notification without leaking secrets", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "short-lived-access-token", expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ name: "projects/nantty-test/messages/123" }), { status: 200 });
    };
    const sender = await makeSender(fetcher);

    const result = await sender.send(["fcm-device-registration"], { title: "Hello", body: "There", data: { route: "/inbox", count: 2 } });

    expect(result).toEqual({ acceptedCount: 1, failures: [] });
    expect(calls.map((call) => call.url)).toEqual([
      "https://oauth2.googleapis.com/token",
      "https://fcm.googleapis.com/v1/projects/nantty-test/messages:send",
    ]);
    expect(String(calls[1]?.init?.body)).toContain('"notification":{"title":"Hello","body":"There"}');
    expect(String(calls[1]?.init?.body)).toContain('"data":{"route":"/inbox","count":"2"}');
    expect(JSON.stringify(result)).not.toContain("short-lived-access-token");
  });

  it("sends bubble-eligible chat as high-priority data-only FCM for native bubble rendering", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "access", expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ name: "projects/nantty-test/messages/chat" }), { status: 200 });
    };
    const sender = await makeSender(fetcher);

    const result = await sender.send(["fcm-device-registration"], {
      title: "Nantty",
      body: "New message",
      categoryId: "NANTTY_CHAT",
      threadId: "conversation-1",
      channelId: "nantty-chat-sound-still",
      data: { conversationId: "conversation-1", bubbleAllowed: "true" },
    });

    expect(result).toEqual({ acceptedCount: 1, failures: [] });
    const requestBody = JSON.parse(String(calls[1]?.init?.body)) as { message: Record<string, unknown> };
    expect(requestBody.message["notification"]).toBeUndefined();
    expect(requestBody.message["android"]).toEqual({ priority: "HIGH" });
    expect(requestBody.message["data"]).toMatchObject({
      title: "Nantty",
      message: "New message",
      conversationId: "conversation-1",
      bubbleAllowed: "true",
      categoryId: "NANTTY_CHAT",
      threadIdentifier: "conversation-1",
      channelId: "nantty-chat-sound-still",
    });
  });

  it("classifies an unregistered FCM token for provider-specific pruning", async () => {
    let sendCalls = 0;
    const fetcher: typeof fetch = async (input) => {
      if (String(input) === "https://oauth2.googleapis.com/token") return new Response(JSON.stringify({ access_token: "access", expires_in: 3600 }), { status: 200 });
      sendCalls += 1;
      return fcmFailure("UNREGISTERED");
    };
    const sender = await makeSender(fetcher);

    const result = await sender.send(["stale-fcm-token"], { title: "Hi", body: "There" });

    expect(sendCalls).toBe(1);
    expect(result.failures).toEqual([{ token: "stale-fcm-token", classification: "permanent", code: "UNREGISTERED" }]);
    expect(JSON.stringify(result)).not.toContain("provider response must not be retained");
  });

  it("does not classify invalid payload errors as stale device tokens", async () => {
    const fetcher: typeof fetch = async (input) => {
      if (String(input) === "https://oauth2.googleapis.com/token") return new Response(JSON.stringify({ access_token: "access", expires_in: 3600 }), { status: 200 });
      return fcmFailure("INVALID_ARGUMENT");
    };
    const sender = await makeSender(fetcher);

    const result = await sender.send(["possibly-valid-fcm-token"], { title: "Hi", body: "There" });

    expect(result.failures).toEqual([{ token: "possibly-valid-fcm-token", classification: "permanent", code: "INVALID_ARGUMENT" }]);
  });

  it("classifies provider outages as retryable and does not expose response bodies", async () => {
    const fetcher: typeof fetch = async (input) => {
      if (String(input) === "https://oauth2.googleapis.com/token") return new Response(JSON.stringify({ access_token: "access", expires_in: 3600 }), { status: 200 });
      return new Response("credential=do-not-log", { status: 503 });
    };
    const sender = await makeSender(fetcher);

    const result = await sender.send(["device-token"], { title: "Hi", body: "There" });

    expect(result.failures).toEqual([{ token: "device-token", classification: "retryable", code: "HTTP_503" }]);
    expect(JSON.stringify(result)).not.toContain("credential");
  });

  it("caches access tokens across sends", async () => {
    let oauthCalls = 0;
    const fetcher: typeof fetch = async (input) => {
      if (String(input) === "https://oauth2.googleapis.com/token") {
        oauthCalls += 1;
        return new Response(JSON.stringify({ access_token: "access", expires_in: 3600 }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    };
    const sender = await makeSender(fetcher);

    await sender.send(["one"], { title: "Hi", body: "There" });
    await sender.send(["two"], { title: "Hi", body: "There" });

    expect(oauthCalls).toBe(1);
  });
});
