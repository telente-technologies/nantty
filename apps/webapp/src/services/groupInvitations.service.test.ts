import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { chatGroupsService, groupInvitationsService } from "./chatGroups.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("group invitation web service", () => {
  it("sends an authenticated username-selected group invitation without adding membership", async () => {
    let requestUrl = "";
    let requestInit: RequestInit = {};
    const pendingInvitation = {
      id: "invitation-1",
      conversationId: "group/1",
      inviterId: "viewer-1",
      inviteeId: "invitee-1",
      status: "pending",
      createdAt: "2026-11-06T12:00:00.000Z",
      expiresAt: "2026-11-13T12:00:00.000Z",
      counterpart: null,
      membershipStatus: "not_joined",
    };
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify(pendingInvitation), { status: 201, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const result = await chatGroupsService.createInvitation("group/1", "invitee/1");

    assert.deepEqual(result, pendingInvitation);
    assert.equal(requestUrl, "/bff/api/v1/conversations/group%2F1/invitations");
    assert.deepEqual(JSON.parse(String(requestInit.body)), { inviteeId: "invitee/1" });
    assert.equal(requestInit.method, "POST");
    assert.match(new Headers(requestInit.headers).get("Idempotency-Key") ?? "", /^group_invitation_[a-f0-9]{32}$/);
    assert.equal(result.membershipStatus, "not_joined");
  });

  it("creates, lists, and revokes admin invitation links using the group API contract", async () => {
    const requests: { url: string; method: string; body?: string; idempotencyKey?: string | null }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      requests.push({ url: String(input), method: init.method ?? "GET", body: typeof init.body === "string" ? init.body : undefined, idempotencyKey: new Headers(init.headers).get("Idempotency-Key") });
      const payload = requests.length === 1
        ? { id: "link-1", conversationId: "group/1", token: "secret-once", expiresAt: "2026-11-13T12:00:00.000Z" }
        : requests.length === 2
          ? { data: [{ id: "link-1", conversationId: "group/1", createdAt: "2026-11-06T12:00:00.000Z", expiresAt: "2026-11-13T12:00:00.000Z", revokedAt: null }], nextCursor: null }
          : { id: "link-1", conversationId: "group/1", createdAt: "2026-11-06T12:00:00.000Z", expiresAt: "2026-11-13T12:00:00.000Z", revokedAt: "2026-11-06T13:00:00.000Z" };
      return new Response(JSON.stringify(payload), { status: requests.length === 1 ? 201 : 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const created = await chatGroupsService.createInvitationLink("group/1", 168);
    const page = await chatGroupsService.listInvitationLinks("group/1", "cursor/next");
    const revoked = await chatGroupsService.revokeInvitationLink("group/1", "link/1");

    assert.equal(created.token, "secret-once");
    assert.equal(requests[0]?.url, "/bff/api/v1/conversations/group%2F1/invitation-links");
    assert.deepEqual(JSON.parse(requests[0]?.body ?? "{}"), { expiresInHours: 168 });
    assert.match(requests[0]?.idempotencyKey ?? "", /^group_invitation_link_[a-f0-9]{32}$/);
    assert.equal(requests[1]?.url, "/bff/api/v1/conversations/group%2F1/invitation-links?cursor=cursor%2Fnext&limit=20");
    assert.equal(page.data[0]?.id, "link-1");
    assert.equal(requests[2]?.url, "/bff/api/v1/conversations/group%2F1/invitation-links/link%2F1");
    assert.equal(requests[2]?.method, "DELETE");
    assert.match(requests[2]?.idempotencyKey ?? "", /^group_invitation_link_revoke_[a-f0-9]{32}$/);
    assert.ok(revoked.revokedAt);
  });

  it("loads only the authenticated safe preview endpoint with opaque token encoding", async () => {
    let requestUrl = "";
    let requestInit: RequestInit = {};
    const preview = { group: { title: "Weekend plans", memberCount: 8 }, expiresAt: "2026-11-13T12:00:00.000Z" };
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify(preview), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    assert.deepEqual(await groupInvitationsService.previewLink("token/with+reserved?chars"), preview);
    assert.equal(requestUrl, "/bff/api/v1/conversations/invitation-links/token%2Fwith%2Breserved%3Fchars/preview");
    assert.equal(requestInit.credentials, "same-origin");
    assert.equal(requestInit.cache, "no-store");
    assert.equal(requestInit.method, "GET");
  });

  it("claims a link without accepting it and uses a fresh idempotency key", async () => {
    let requestUrl = "";
    let requestInit: RequestInit = {};
    const pendingInvitation = {
      id: "invitation-1",
      conversationId: "group-1",
      inviterId: "member-1",
      inviteeId: "viewer-1",
      status: "pending",
      createdAt: "2026-11-06T12:00:00.000Z",
      expiresAt: "2026-11-13T12:00:00.000Z",
      counterpart: null,
      membershipStatus: "not_joined",
    };
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify(pendingInvitation), { status: 201, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const result = await groupInvitationsService.claimLink("opaque-token");
    assert.deepEqual(result, pendingInvitation);
    assert.equal(requestUrl, "/bff/api/v1/conversations/invitation-links/opaque-token/claim");
    assert.equal(requestInit.method, "POST");
    assert.equal(requestInit.body, undefined);
    assert.match(new Headers(requestInit.headers).get("Idempotency-Key") ?? "", /^group_invitation_claim_[a-f0-9]{32}$/);
    assert.equal(requestUrl.includes("/accept"), false);
  });

  it("fetches received invitations and explicitly accepts only from the inbox action", async () => {
    const requests: { url: string; method: string }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      requests.push({ url: String(input), method: init.method ?? "GET" });
      const payload = requests.length === 1
        ? { data: [], nextCursor: null }
        : { id: "invitation-1", conversationId: "group-1", inviterId: "member-1", inviteeId: "viewer-1", status: "accepted", createdAt: "2026-11-06T12:00:00.000Z", expiresAt: "2026-11-13T12:00:00.000Z", counterpart: null, membershipStatus: "awaiting_secure_key_handoff" };
      return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const page = await groupInvitationsService.listReceived();
    const accepted = await groupInvitationsService.accept("invitation/1");
    assert.deepEqual(page, { data: [], nextCursor: null });
    assert.equal(requests[0]?.url, "/bff/api/v1/group-invitations?direction=received&limit=20");
    assert.equal(requests[1]?.url, "/bff/api/v1/group-invitations/invitation%2F1/accept");
    assert.equal(requests[1]?.method, "POST");
    assert.equal(accepted.membershipStatus, "awaiting_secure_key_handoff");
  });
});
