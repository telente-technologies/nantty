import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { WebappRequestError } from "./clientApi.service";
import { linkedProfilesService } from "./linkedProfiles.service";
import { postsService } from "./posts.service";
import { privacyService } from "./privacy.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("PAR-011..013 webapp parity endpoints call the verified API contracts", async () => {
  const requests: { url: string; method: string; body?: string }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    requests.push({ url, method, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
    if (url.endsWith("/deletion-request") && method === "GET") {
      if (requests.length === 1) {
        return new Response(JSON.stringify({ code: "NOT_FOUND", message: "No account deletion request found" }), { status: 404, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ status: "scheduled", scheduledFor: "2026-12-16T00:00:00Z" }), { status: 200 });
    }
    if (url.endsWith("/deletion-request/cancel")) {
      return new Response(JSON.stringify({ status: "cancelled", scheduledFor: "2026-12-16T00:00:00Z" }), { status: 200 });
    }
    if (url.endsWith("/tagging-settings")) {
      return new Response(JSON.stringify({ allowTagging: false }), { status: 200 });
    }
    if (url.endsWith("/stores/team-requests")) {
      return new Response(JSON.stringify({ data: [], nextCursor: null }), { status: 200 });
    }
    if (method === "DELETE" || url.endsWith("/accept") || url.endsWith("/decline")) {
      return new Response(null, { status: 204 });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  assert.equal(await privacyService.fetchAccountDeletionStatus(), null);
  const scheduled = await privacyService.fetchAccountDeletionStatus();
  assert.equal(scheduled?.status, "scheduled");
  await privacyService.cancelAccountDeletion();

  await privacyService.fetchMyTaggingSettings();
  await privacyService.updateMyTaggingSettings(false);
  await postsService.removeMyPostTag("post/99");
  await linkedProfilesService.fetchStoreTeamRequests();
  await linkedProfilesService.acceptStoreTeamRequest("req_1");
  await linkedProfilesService.declineStoreTeamRequest("req_2");

  assert.deepEqual(
    requests.map(({ url, method }) => [url, method]),
    [
      ["/bff/api/v1/users/me/deletion-request", "GET"],
      ["/bff/api/v1/users/me/deletion-request", "GET"],
      ["/bff/api/v1/users/me/deletion-request/cancel", "POST"],
      ["/bff/api/v1/me/tagging-settings", "GET"],
      ["/bff/api/v1/me/tagging-settings", "PUT"],
      ["/bff/api/v1/posts/post%2F99/tags/me", "DELETE"],
      ["/bff/api/v1/stores/team-requests", "GET"],
      ["/bff/api/v1/stores/team-requests/req_1/accept", "POST"],
      ["/bff/api/v1/stores/team-requests/req_2/decline", "POST"],
    ],
  );
  assert.equal(requests[4]?.body, JSON.stringify({ allowTagging: false }));
  assert.ok(WebappRequestError);
});
