import { beforeAll, describe, expect, it } from "vitest";

import { registerUser, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, waitFor } from "../src/apiClient.util.js";
import { expectClearError } from "../src/journeyChecks.util.js";
import { uploadSampleImage } from "../src/mediaUpload.util.js";

describe("downloads of blocked, private and protected content", () => {
  let creator: UserActor;
  let viewer: UserActor;
  let follower: UserActor;
  let postId = "";
  let mediaId = "";

  const download = (actor: UserActor | undefined, target = mediaId) => callApi("POST", `/api/v1/posts/${postId}/media/${target}/download`, { ...(actor === undefined ? {} : { token: actor.accessToken }), body: {} });

  beforeAll(async () => {
    [creator, viewer, follower] = await Promise.all([registerUser("edgedlcreator"), registerUser("edgedlviewer"), registerUser("edgedlfollower")]);
    mediaId = (await uploadSampleImage(creator.accessToken)).mediaId;
    const created = await callApi("POST", "/api/v1/posts", { token: creator.accessToken, body: { text: "Download me", mediaIds: [mediaId], audience: "everyone" } });
    expect(created.status, describeResponse(created)).toBe(201);
    postId = created.body.id;
    const followed = await callApi("POST", `/api/v1/users/${creator.accountId}/follow`, { token: follower.accessToken, body: {} });
    expect([200, 201], describeResponse(followed)).toContain(followed.status);
  });

  it("lets a signed-in viewer download a public post and asks guests to sign in", async () => {
    const allowed = await download(viewer);
    expect([200, 201, 202], describeResponse(allowed)).toContain(allowed.status);
    const guest = await download(undefined);
    expectClearError(guest, 401);
    const wrongMedia = await download(viewer, "00000000-0000-4000-8000-000000000000");
    expectClearError(wrongMedia, [400, 404], ["MEDIA_NOT_IN_POST", "VALIDATION_FAILED"]);
  });

  it("refuses when the creator turned downloads off, and allows again when turned back on", async () => {
    const off = await callApi("PUT", "/api/v1/me/download-settings", { token: creator.accessToken, body: { allowDownloads: false } });
    expect(off.status, describeResponse(off)).toBe(200);
    expectClearError(await download(viewer), 403, "DOWNLOADS_DISABLED");
    const own = await download(creator);
    expect([200, 201, 202], `the author can always download: ${describeResponse(own)}`).toContain(own.status);
    await callApi("PUT", "/api/v1/me/download-settings", { token: creator.accessToken, body: { allowDownloads: true } });
    const back = await download(viewer);
    expect([200, 201, 202], describeResponse(back)).toContain(back.status);
  });

  it("refuses downloads from a private account, even for followers", async () => {
    const made = await callApi("PATCH", "/api/v1/users/me", { token: creator.accessToken, body: { isPrivate: true } });
    expect(made.status, describeResponse(made)).toBe(200);
    const refusedStranger = await waitFor(async () => {
      const response = await download(viewer);
      return response.status >= 400 ? response : undefined;
    }, 15_000, 1000);
    expect(refusedStranger, "a stranger could still download from a private account").toBeDefined();
    expectClearError(refusedStranger!, [403, 404], ["PRIVATE_ACCOUNT", "ACCOUNT_PRIVATE", "POST_NOT_FOUND"]);
    const refusedFollower = await waitFor(async () => {
      const response = await download(follower);
      return response.status >= 400 ? response : undefined;
    }, 15_000, 1000);
    expectClearError(refusedFollower!, 403, "PRIVATE_ACCOUNT");
    await callApi("PATCH", "/api/v1/users/me", { token: creator.accessToken, body: { isPrivate: false } });
  });

  it("refuses downloads to someone the creator blocked", async () => {
    await waitFor(async () => ((await download(viewer)).status < 400 ? true : undefined), 15_000, 1000);
    const blocked = await callApi("POST", `/api/v1/users/${viewer.accountId}/block`, { token: creator.accessToken, body: {} });
    expect([200, 201, 204], describeResponse(blocked)).toContain(blocked.status);
    expectClearError(await download(viewer), [403, 404]);
  });
});
