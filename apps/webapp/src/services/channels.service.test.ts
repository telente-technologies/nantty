import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { channelsService } from "./channels.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("broadcast channels", () => {
  it("creates a channel through the shared channel endpoint", async () => {
    let requestUrl = "";
    let requestInit: RequestInit = {};
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify({ id: "channel_1", kind: "channel", title: "Updates" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const channel = await channelsService.createBroadcastChannel({ name: "Updates", description: "News" });

    assert.equal(requestUrl, "/bff/api/v1/channels");
    assert.equal(requestInit.method, "POST");
    assert.deepEqual(JSON.parse(String(requestInit.body)), { name: "Updates", description: "News" });
    assert.equal(channel.id, "channel_1");
  });

  it("supports owner-managed invitation links and explicit invitee consent routes", async () => {
    const requests: { url: string; method: string; body?: unknown; headers: Headers }[] = [];
    const responses = [
      { id: "link-1", channelId: "channel/1", token: "opaque-token", expiresAt: "2026-11-13T12:00:00Z" },
      { data: [{ id: "link-1", channelId: "channel/1", expiresAt: "2026-11-13T12:00:00Z", revokedAt: null }], nextCursor: null },
      { channel: { title: "Updates", subscriberCount: 3 }, expiresAt: "2026-11-13T12:00:00Z" },
      { id: "invite-1", channelId: "channel-1", status: "pending" },
      { data: [{ id: "invite-1", channelId: "channel-1", status: "pending" }], nextCursor: null },
      { id: "invite-1", channelId: "channel-1", status: "accepted" },
      { id: "invite-2", channelId: "channel-1", status: "declined" },
      { id: "link-1", channelId: "channel/1", revokedAt: "2026-11-06T12:00:00Z" },
    ];
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      requests.push({ url: String(input), method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined, headers: new Headers(init.headers) });
      const payload = responses.shift();
      if (!payload) throw new Error("Unexpected API request");
      return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const link = await channelsService.createInvitationLink("channel/1", 24);
    const links = await channelsService.listInvitationLinks("channel/1", "cursor");
    await channelsService.previewInvitationLink("token/with+reserved");
    const pending = await channelsService.claimInvitationLink("token/with+reserved");
    await channelsService.listInvitations();
    await channelsService.acceptInvitation("invite/1");
    await channelsService.declineInvitation("invite-2");
    await channelsService.revokeInvitationLink("channel/1", link.id);

    assert.equal(requests[0]?.url, "/bff/api/v1/channels/channel%2F1/invitation-links");
    assert.equal(requests[0]?.method, "POST");
    assert.deepEqual(requests[0]?.body, { expiresInHours: 24 });
    assert.ok(requests[0]?.headers.get("Idempotency-Key"));
    assert.equal(requests[1]?.url, "/bff/api/v1/channels/channel%2F1/invitation-links?cursor=cursor&limit=20");
    assert.equal(requests[2]?.url, "/bff/api/v1/channels/invitation-links/token%2Fwith%2Breserved/preview");
    assert.equal(requests[3]?.url, "/bff/api/v1/channels/invitation-links/token%2Fwith%2Breserved/claim");
    assert.equal(pending.status, "pending");
    assert.equal(requests[4]?.url, "/bff/api/v1/channel-invitations?status=pending&limit=20");
    assert.equal(requests[5]?.url, "/bff/api/v1/channel-invitations/invite%2F1/accept");
    assert.equal(requests[6]?.url, "/bff/api/v1/channel-invitations/invite-2/decline");
    assert.equal(requests[7]?.url, "/bff/api/v1/channels/channel%2F1/invitation-links/link-1");
    assert.equal(requests[7]?.method, "DELETE");
    assert.equal(links.data[0] && "token" in links.data[0], false, "management responses must not contain bearer tokens");
  });
});
