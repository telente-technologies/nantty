import { beforeAll, describe, expect, it } from "vitest";

import { createSuperadmin, registerUser, type StaffActor, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, waitFor } from "../src/apiClient.util.js";
import { isListEnvelope } from "../src/smokeReport.util.js";

describe("trust journey: chat request → accept → report → admin action → notification", () => {
  let sender: UserActor;
  let recipient: UserActor;
  let staff: StaffActor;
  let conversationId = "";
  let postId = "";

  beforeAll(async () => {
    sender = await registerUser("chatter");
    recipient = await registerUser("chatee");
    staff = await createSuperadmin();
  });

  it("starts a message request that lands in the recipient's requests folder", async () => {
    const started = await callApi("POST", "/api/v1/conversations", { token: sender.accessToken, body: { userId: recipient.accountId } });
    expect([200, 201], describeResponse(started)).toContain(started.status);
    conversationId = started.body.id ?? started.body.conversation?.id;
    const sent = await callApi("POST", `/api/v1/conversations/${conversationId}/messages`, { token: sender.accessToken, body: { kind: "text", encryption: { deviceId: "smoke-device-1", ciphertext: Buffer.from("opaque smoke ciphertext 1").toString("base64"), protocol: "signal-v1" } } });
    expect([200, 201], describeResponse(sent)).toContain(sent.status);
    const requests = await callApi("GET", "/api/v1/conversations?folder=requests", { token: recipient.accessToken });
    expect(isListEnvelope(requests.body), describeResponse(requests)).toBe(true);
    expect(JSON.stringify(requests.body)).toContain(conversationId);
  });

  it("accepts the request and moves the conversation to chats", async () => {
    const accepted = await callApi("POST", `/api/v1/conversations/${conversationId}/accept`, { token: recipient.accessToken, body: {} });
    expect([200, 201, 204], describeResponse(accepted)).toContain(accepted.status);
    const chats = await callApi("GET", "/api/v1/conversations?folder=chats", { token: recipient.accessToken });
    expect(JSON.stringify(chats.body), describeResponse(chats)).toContain(conversationId);
    const reply = await callApi("POST", `/api/v1/conversations/${conversationId}/messages`, { token: recipient.accessToken, body: { kind: "text", encryption: { deviceId: "smoke-device-2", ciphertext: Buffer.from("opaque smoke ciphertext 2").toString("base64"), protocol: "signal-v1" } } });
    expect([200, 201], describeResponse(reply)).toContain(reply.status);
    const messages = await callApi("GET", `/api/v1/conversations/${conversationId}/messages`, { token: sender.accessToken });
    expect(isListEnvelope(messages.body), describeResponse(messages)).toBe(true);
  });

  it("refuses a third party reading the conversation", async () => {
    const outsider = await registerUser("outsider");
    const response = await callApi("GET", `/api/v1/conversations/${conversationId}/messages`, { token: outsider.accessToken });
    expect([403, 404], describeResponse(response)).toContain(response.status);
  });

  it("reports a post and lets staff act on it", async () => {
    const post = await callApi("POST", "/api/v1/posts", { token: sender.accessToken, body: { text: "Buy followers cheap, DM me now" } });
    expect(post.status, describeResponse(post)).toBe(201);
    postId = post.body.id;
    const reported = await callApi("POST", "/api/v1/reports", { token: recipient.accessToken, body: { targetType: "post", targetId: postId, reportedUserId: sender.accountId, reason: "spam", details: "Smoke report" } });
    expect([200, 201, 202], describeResponse(reported)).toContain(reported.status);
    const report = await waitFor(async () => {
      const list = await callApi("GET", "/api/v1/admin/reports?status=all", { token: staff.accessToken });
      expect(list.status, describeResponse(list)).toBe(200);
      return (list.body.data as Array<{ id: string; targetId?: string }>).find((candidate) => JSON.stringify(candidate).includes(postId));
    }, 20_000, 1000);
    expect(report, "report never reached the trust queue").toBeDefined();
    const acted = await callApi("POST", `/api/v1/admin/reports/${report?.id}/actions`, { token: staff.accessToken, body: { action: "HIDE", reason: "Spam content hidden by the smoke test" } });
    expect([200, 204], describeResponse(acted)).toContain(acted.status);
    const hidden = await waitFor(async () => {
      const read = await callApi("GET", `/api/v1/posts/${postId}`, { token: recipient.accessToken });
      return read.status === 404 || /hidden|restricted/i.test(JSON.stringify(read.body)) ? read : undefined;
    }, 20_000, 1000);
    expect(hidden, "hidden post is still visible to other users").toBeDefined();
  });

  it("refuses the admin report queue to a customer token", async () => {
    const response = await callApi("GET", "/api/v1/admin/reports", { token: recipient.accessToken });
    expect([401, 403], describeResponse(response)).toContain(response.status);
  });

  it("delivers in-app notifications to the recipient", async () => {
    const inbox = await waitFor(async () => {
      const response = await callApi("GET", "/api/v1/notifications", { token: recipient.accessToken });
      return isListEnvelope(response.body) && (response.body.data as unknown[]).length > 0 ? response : undefined;
    }, 20_000, 1000);
    expect(inbox, "recipient inbox stayed empty").toBeDefined();
    const unread = await callApi("GET", "/api/v1/notifications/unread-count", { token: recipient.accessToken });
    expect([200, 404], describeResponse(unread)).toContain(unread.status);
  });
});
