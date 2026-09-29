import { afterAll, describe, expect, it } from "vitest";

import { NotificationRequestedEvent } from "../../../src/events/notificationRequested.event.js";
import { publishEvent } from "../../../src/loaders/events.loader.js";
import type { PushMessage, PushSender } from "../../../src/modules/notifications/channels/push.channel.js";
import { createTestApplication } from "../../fixtures/testApplication.fixture.js";

class RecordingPushSender implements PushSender {
  public readonly sent: PushMessage[] = [];

  public async sendPushMessage(message: PushMessage): Promise<void> {
    this.sent.push(message);
  }
}

class RecordingEmailSender {
  public readonly sent: { to: string; subject: string }[] = [];

  public async sendNotificationEmail(to: string, subject: string): Promise<void> {
    this.sent.push({ to, subject });
  }
}

const pushSender = new RecordingPushSender();
const emailSender = new RecordingEmailSender();
const app = createTestApplication({ external: { pushSender, notificationEmailSender: emailSender } });
afterAll(() => app.close());

interface NotificationPage {
  readonly data: { readonly id: string; readonly category: string; readonly read: boolean }[];
}

function requestNotification(userId: string, category: "orders" | "social" | "promotions", title: string) {
  return publishEvent(app.dependencies.core.events, NotificationRequestedEvent, { userId, category, title, body: `${title} body` });
}

describe("notifications", () => {
  it("sends a welcome notification when a user registers", async () => {
    const user = await app.registerUser();
    const page = await app.client.get("/api/v1/notifications").auth(user.accessToken).expect(200);
    expect(page.json<NotificationPage>().data.map((item) => item.category)).toEqual(["social"]);
  });

  it("stores and pushes requested notifications to registered devices", async () => {
    const user = await app.registerUser();
    await app.client.post("/api/v1/notifications/device-tokens").auth(user.accessToken).send({ token: "device-token-abc-123", platform: "ios" }).expect(204);
    pushSender.sent.length = 0;
    await requestNotification(user.userId, "orders", "Order shipped");
    expect(pushSender.sent).toHaveLength(1);
    expect(pushSender.sent[0]?.deviceTokens).toEqual(["device-token-abc-123"]);
    const counts = await app.client.get("/api/v1/notifications/unread-count").auth(user.accessToken).expect(200);
    expect(counts.json()).toEqual({ total: 2, byCategory: { social: 1, orders: 1, system: 0 } });
  });

  it("emails order notifications only to verified email addresses", async () => {
    app.identityTokens.identities.set("google:unverified-email-token-padded", {
      provider: "google", subject: "google-unverified", email: "unverified@example.com", emailVerified: false, name: "Unverified",
    });
    const socialUser = (await app.client.post("/api/v1/auth/google").send({ idToken: "unverified-email-token-padded" }).expect(201)).json<{ user: { id: string } }>();
    emailSender.sent.length = 0;
    await requestNotification(socialUser.user.id, "orders", "Order placed");
    expect(emailSender.sent).toHaveLength(0);
    const user = await app.registerUser();
    await requestNotification(user.userId, "orders", "Order delivered");
    expect(emailSender.sent).toEqual([{ to: user.email, subject: "Order delivered" }]);
  });

  it("respects per-category preferences", async () => {
    const user = await app.registerUser();
    await app.client.get("/api/v1/notifications/preferences").auth(user.accessToken).expect(200).expectJson({ promotions: false, orders: true });
    await requestNotification(user.userId, "promotions", "Big sale");
    await app.client.patch("/api/v1/notifications/preferences").auth(user.accessToken).send({ orders: false }).expect(200).expectJson({ orders: false });
    await requestNotification(user.userId, "orders", "Order update");
    const page = await app.client.get("/api/v1/notifications").auth(user.accessToken).expect(200);
    expect(page.json<NotificationPage>().data.map((item) => item.category)).toEqual(["social"]);
  });

  it("marks notifications read for the owner only", async () => {
    const owner = await app.registerUser();
    const stranger = await app.registerUser();
    await requestNotification(owner.userId, "orders", "Payment received");
    const page = await app.client.get("/api/v1/notifications").query({ category: "orders" }).auth(owner.accessToken).expect(200);
    const notificationId = page.json<NotificationPage>().data[0]?.id ?? "";
    await app.client.post(`/api/v1/notifications/${notificationId}/read`).auth(stranger.accessToken).expect(404);
    await app.client.post(`/api/v1/notifications/${notificationId}/read`).auth(owner.accessToken).expect(204);
    const unread = await app.client.get("/api/v1/notifications").query({ unreadOnly: "true" }).auth(owner.accessToken).expect(200);
    expect(unread.json<NotificationPage>().data.map((item) => item.category)).toEqual(["social"]);
    await app.client.post("/api/v1/notifications/read-all").auth(owner.accessToken).expect(200).expectJson({ updated: 1 });
    await app.client.get("/api/v1/notifications/unread-count").auth(owner.accessToken).expect(200).expectJson({ total: 0 });
  });

  it("only lets users remove their own device tokens", async () => {
    const owner = await app.registerUser();
    const stranger = await app.registerUser();
    await app.client.post("/api/v1/notifications/device-tokens").auth(owner.accessToken).send({ token: "owner-device-token-1", platform: "android" }).expect(204);
    await app.client.delete("/api/v1/notifications/device-tokens/owner-device-token-1").auth(stranger.accessToken).expect(404);
    await app.client.delete("/api/v1/notifications/device-tokens/owner-device-token-1").auth(owner.accessToken).expect(204);
  });

  it("requires authentication", async () => {
    await app.client.get("/api/v1/notifications").expect(401);
  });
});
