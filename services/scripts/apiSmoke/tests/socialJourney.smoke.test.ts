import { beforeAll, describe, expect, it } from "vitest";

import { registerUser, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, uniqueSuffix, waitFor } from "../src/apiClient.util.js";
import { uploadSampleImage } from "../src/mediaUpload.util.js";
import { isErrorShape, isListEnvelope } from "../src/smokeReport.util.js";

describe("social journey: signup → profile → follow → post with media → feed → comment with mention → save → search → notifications", () => {
  let creator: UserActor;
  let fan: UserActor;
  let postId = "";
  let mediaId = "";
  const keyword = `smokeword${uniqueSuffix()}`;

  beforeAll(async () => {
    creator = await registerUser("creator");
    fan = await registerUser("fan");
  });

  it("updates and reads the profile", async () => {
    const updated = await callApi("PATCH", "/api/v1/users/me", { token: creator.accessToken, body: { bio: `Smoke creator ${keyword}` } });
    expect(updated.status, describeResponse(updated)).toBe(200);
    const me = await callApi("GET", "/api/v1/users/me", { token: creator.accessToken });
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.body)).toContain(keyword);
    const publicProfile = await callApi("GET", `/api/v1/users/by-username/${creator.username}`);
    expect(publicProfile.status, describeResponse(publicProfile)).toBe(200);
  });

  it("refuses profile writes without a token", async () => {
    const response = await callApi("PATCH", "/api/v1/users/me", { body: { bio: "nope" } });
    expect(response.status).toBe(401);
    expect(isErrorShape(response.body)).toBe(true);
  });

  it("follows the creator", async () => {
    const followed = await callApi("POST", `/api/v1/users/${creator.accountId}/follow`, { token: fan.accessToken, body: {} });
    expect([200, 201], describeResponse(followed)).toContain(followed.status);
    const status = await callApi("GET", `/api/v1/users/${creator.accountId}/follow-status`, { token: fan.accessToken });
    expect(status.status, describeResponse(status)).toBe(200);
    expect(JSON.stringify(status.body)).toMatch(/following|true/i);
    const followers = await callApi("GET", `/api/v1/users/${creator.accountId}/followers`, { token: fan.accessToken });
    expect(isListEnvelope(followers.body), describeResponse(followers)).toBe(true);
  });

  it("uploads an image through the plan → S3 PUT → processing pipeline", async () => {
    const uploaded = await uploadSampleImage(creator.accessToken);
    mediaId = uploaded.mediaId;
    expect(uploaded.asset.width).toBe(320);
    expect(uploaded.asset.variants.length).toBeGreaterThan(0);
    const variant = await fetch(uploaded.asset.variants[0]?.url ?? "");
    expect(variant.status).toBe(200);
  });

  it("publishes a post with the media and a mention", async () => {
    const text = `Hello @${fan.username} ${keyword}`;
    const created = await callApi("POST", "/api/v1/posts", {
      token: creator.accessToken,
      body: { text, mediaIds: [mediaId], audience: "everyone", mentions: [{ userId: fan.accountId, username: fan.username, start: 6, length: fan.username.length + 1 }] },
    });
    expect(created.status, describeResponse(created)).toBe(201);
    postId = created.body.id ?? created.body.post?.id;
    expect(postId).toBeTruthy();
    const read = await callApi("GET", `/api/v1/posts/${postId}`);
    expect(read.status, describeResponse(read)).toBe(200);
  });

  it("shows the post in the follower's feed", async () => {
    const found = await waitFor(async () => {
      const feed = await callApi("GET", "/api/v1/feeds/following", { token: fan.accessToken });
      expect(isListEnvelope(feed.body), describeResponse(feed)).toBe(true);
      return JSON.stringify(feed.body).includes(postId) ? true : undefined;
    }, 15_000, 500);
    expect(found, "post never reached the following feed").toBe(true);
    const forYou = await callApi("GET", "/api/v1/feeds/for-you", { token: fan.accessToken });
    expect(forYou.status, describeResponse(forYou)).toBe(200);
    const guestFeed = await callApi("GET", "/api/v1/feeds/popular");
    expect(guestFeed.status, describeResponse(guestFeed)).toBe(200);
  });

  it("comments with a mention and likes", async () => {
    const text = `@${creator.username} great post`;
    const comment = await callApi("POST", `/api/v1/posts/${postId}/comments`, { token: fan.accessToken, body: { text, mentions: [{ userId: creator.accountId, username: creator.username, start: 0, length: creator.username.length + 1 }] } });
    expect(comment.status, describeResponse(comment)).toBe(201);
    const comments = await callApi("GET", `/api/v1/posts/${postId}/comments`);
    expect(isListEnvelope(comments.body), describeResponse(comments)).toBe(true);
    expect(JSON.stringify(comments.body)).toContain("great post");
    const liked = await callApi("POST", `/api/v1/posts/${postId}/like`, { token: fan.accessToken, body: {} });
    expect([200, 201, 204], describeResponse(liked)).toContain(liked.status);
  });

  it("bookmarks the post and bumps saveCount", async () => {
    const saved = await callApi("POST", "/api/v1/saves", { token: fan.accessToken, body: { type: "post", targetId: postId } });
    expect([200, 201, 204], describeResponse(saved)).toContain(saved.status);
    const post = await callApi("GET", `/api/v1/posts/${postId}`, { token: fan.accessToken });
    expect(JSON.stringify(post.body), describeResponse(post)).toMatch(/"saveCount":1/);
    const saves = await callApi("GET", "/api/v1/saves", { token: fan.accessToken });
    expect(isListEnvelope(saves.body), describeResponse(saves)).toBe(true);
    expect(JSON.stringify(saves.body)).toContain(postId);
  });

  it("finds the creator and the post through search", async () => {
    const people = await waitFor(async () => {
      const response = await callApi("GET", `/api/v1/search/people?q=${encodeURIComponent(creator.username)}`, { token: fan.accessToken });
      return JSON.stringify(response.body).includes(creator.accountId) ? response : undefined;
    }, 15_000, 500);
    expect(people, "creator not found by people search").toBeDefined();
    const posts = await waitFor(async () => {
      const response = await callApi("GET", `/api/v1/search?q=${keyword}`, { token: fan.accessToken });
      expect(response.status, describeResponse(response)).toBe(200);
      return JSON.stringify(response.body).includes(postId) ? response : undefined;
    }, 20_000, 1000);
    expect(posts, "post not found by search").toBeDefined();
  });

  it("delivers follow, mention and comment notifications to the creator", async () => {
    const inbox = await waitFor(async () => {
      const response = await callApi("GET", "/api/v1/notifications", { token: creator.accessToken });
      expect(response.status, describeResponse(response)).toBe(200);
      const text = JSON.stringify(response.body);
      return text.includes(fan.accountId) || text.includes(fan.username) ? response : undefined;
    }, 20_000, 1000);
    expect(inbox, "creator inbox has no notification from the fan").toBeDefined();
    expect(isListEnvelope(inbox?.body)).toBe(true);
    const mentioned = await waitFor(async () => {
      const response = await callApi("GET", "/api/v1/notifications", { token: fan.accessToken });
      return JSON.stringify(response.body).includes(creator.accountId) || JSON.stringify(response.body).includes(creator.username) ? response : undefined;
    }, 20_000, 1000);
    expect(mentioned, "fan inbox has no mention notification").toBeDefined();
  });
});
