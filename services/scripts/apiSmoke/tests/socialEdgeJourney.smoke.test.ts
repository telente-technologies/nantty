import { beforeAll, describe, expect, it } from "vitest";

import { registerUser, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, uniqueSuffix, waitFor } from "../src/apiClient.util.js";
import { psql } from "../src/commerceFixtures.util.js";
import { expectClearError, sleep } from "../src/journeyChecks.util.js";

async function publish(author: UserActor, text: string, taggedUserIds: string[] = []): Promise<string> {
  const created = await callApi("POST", "/api/v1/posts", { token: author.accessToken, body: { text, audience: "everyone", taggedUserIds } });
  expect(created.status, describeResponse(created)).toBe(201);
  return created.body.id ?? created.body.post?.id;
}

function taggedIds(postId: string): string[] {
  return psql(`select "taggedUserId" from social.post_tags where "postId" = '${postId}'`).map((row) => row[0] ?? "");
}

describe("social edges: follow, post, comment and tag when people block, delete and race each other", () => {
  let author: UserActor;
  let friend: UserActor;
  let blocker: UserActor;
  let commenter: UserActor;
  const keyword = `edgesocial${uniqueSuffix()}`;

  beforeAll(async () => {
    [author, friend, blocker, commenter] = await Promise.all([registerUser("edgeauthor"), registerUser("edgefriend"), registerUser("edgeblocker"), registerUser("edgecommenter")]);
  });

  it("follows once even when Follow is tapped twice, and refuses to follow yourself", async () => {
    const [first, second] = await Promise.all([
      callApi("POST", `/api/v1/users/${friend.accountId}/follow`, { token: author.accessToken, body: {} }),
      callApi("POST", `/api/v1/users/${friend.accountId}/follow`, { token: author.accessToken, body: {} }),
    ]);
    expect([200, 201], describeResponse(first)).toContain(first.status);
    expect([200, 201, 409], describeResponse(second)).toContain(second.status);
    expect(psql(`select count(*) from social.follows where "followerId" = '${author.accountId}' and "followeeId" = '${friend.accountId}'`)[0]?.[0]).toBe("1");
    const self = await callApi("POST", `/api/v1/users/${author.accountId}/follow`, { token: author.accessToken, body: {} });
    expectClearError(self, 422, "CANNOT_FOLLOW_SELF");
  });

  it("does not let you follow or tag someone who blocked you, and does not tell them you tried", async () => {
    const blocked = await callApi("POST", `/api/v1/users/${author.accountId}/block`, { token: blocker.accessToken, body: {} });
    expect([200, 201, 204], describeResponse(blocked)).toContain(blocked.status);
    const follow = await callApi("POST", `/api/v1/users/${blocker.accountId}/follow`, { token: author.accessToken, body: {} });
    expectClearError(follow, [403, 404], ["FOLLOW_NOT_ALLOWED", "USER_NOT_FOUND"]);
    const postId = await publish(author, `Tagging friends ${keyword}`, [friend.accountId, blocker.accountId]);
    expect(taggedIds(postId)).toEqual([friend.accountId]);
    const retag = await callApi("PUT", `/api/v1/posts/${postId}/tags`, { token: author.accessToken, body: { taggedUserIds: [friend.accountId, blocker.accountId] } });
    expect(retag.status, describeResponse(retag)).toBe(200);
    expect(taggedIds(postId)).toEqual([friend.accountId]);
    const candidates = await callApi("GET", `/api/v1/tags/candidates?q=${blocker.username}`, { token: author.accessToken });
    expect(JSON.stringify(candidates.body), "a blocker must not show up as a tag candidate").not.toContain(blocker.accountId);
    await sleep(2_000);
    const inbox = await callApi("GET", "/api/v1/notifications", { token: blocker.accessToken });
    expect(JSON.stringify(inbox.body), "the blocker gets no tag notification").not.toContain(postId);
    const friendInbox = await waitFor(async () => {
      const response = await callApi("GET", "/api/v1/notifications", { token: friend.accessToken });
      return (response.body?.data ?? []).find((item: { body: string; url: string | null }) => /tagged you/.test(item.body) && item.url === `/post/${postId}`);
    }, 15_000, 1000);
    expect(friendInbox, "the tagged friend is notified with a link to the post").toBeDefined();
  });

  it("refuses a comment on a post that was just deleted, with a clear message", async () => {
    const postId = await publish(author, `Short lived ${keyword}`);
    const deleted = await callApi("DELETE", `/api/v1/posts/${postId}`, { token: author.accessToken });
    expect([200, 204], describeResponse(deleted)).toContain(deleted.status);
    const late = await callApi("POST", `/api/v1/posts/${postId}/comments`, { token: commenter.accessToken, body: { text: "Did I miss it?" } });
    expectClearError(late, 404, "POST_NOT_FOUND");
    const read = await callApi("GET", `/api/v1/posts/${postId}`, { token: commenter.accessToken });
    expectClearError(read, 404);
  });

  it("keeps counts consistent when a post is deleted while people are commenting", async () => {
    for (let round = 0; round < 3; round += 1) {
      const postId = await publish(author, `Race ${round} ${keyword}`);
      const comments = Array.from({ length: 6 }, (_, index) => callApi("POST", `/api/v1/posts/${postId}/comments`, { token: commenter.accessToken, body: { text: `Racing comment ${index}` } }));
      const deletion = sleep(5 * round).then(() => callApi("DELETE", `/api/v1/posts/${postId}`, { token: author.accessToken }));
      const results = await Promise.all([...comments, deletion]);
      for (const result of results.slice(0, -1)) {
        expect([201, 404], describeResponse(result)).toContain(result.status);
        if (result.status === 404) expectClearError(result, 404, "POST_NOT_FOUND");
      }
      expect([200, 204]).toContain(results.at(-1)?.status);
      const [counted, live] = psql(`select p."commentCount", (select count(*) from social.comments c where c."postId" = p.id and c."deletedAt" is null) from social.posts p where p.id = '${postId}'`)[0] ?? [];
      expect(Number(counted), "commentCount matches the comments that were saved").toBe(Number(live));
      expect(Number(live), "only comments that got 201 exist").toBe(results.slice(0, -1).filter((result) => result.status === 201).length);
      const afterwards = await callApi("POST", `/api/v1/posts/${postId}/comments`, { token: commenter.accessToken, body: { text: "after" } });
      expectClearError(afterwards, 404, "POST_NOT_FOUND");
    }
  });

  it("lets the author delete a comment and a stranger cannot", async () => {
    const postId = await publish(author, `Moderated ${keyword}`);
    const comment = await callApi("POST", `/api/v1/posts/${postId}/comments`, { token: commenter.accessToken, body: { text: "Mine" } });
    expect(comment.status, describeResponse(comment)).toBe(201);
    const stranger = await callApi("DELETE", `/api/v1/comments/${comment.body.id}`, { token: friend.accessToken });
    expectClearError(stranger, [403, 404]);
    const removed = await callApi("DELETE", `/api/v1/comments/${comment.body.id}`, { token: commenter.accessToken });
    expect([200, 204], describeResponse(removed)).toContain(removed.status);
    expect(psql(`select "commentCount" from social.posts where id = '${postId}'`)[0]?.[0]).toBe("0");
  });
});
