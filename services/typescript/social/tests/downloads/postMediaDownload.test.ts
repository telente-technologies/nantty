import { describe, expect, it } from "vitest";

import type { MediaDownloadVariantRequest } from "../../src/interfaces/mediaDownloadVariant.interface.js";
import { createRequestPostMediaDownloadHandler } from "../../src/modules/downloads/commands/requestPostMediaDownload/requestPostMediaDownload.handler.js";
import { decidePostDownloadPermission } from "../../src/modules/downloads/services/downloadPermission.service.js";
import type { PostRow } from "../../src/modules/posts/repositories/post.repository.js";
import { buildPostViews } from "../../src/modules/posts/services/postView.service.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { authorId, buildFakeContext, buildPostRow, viewerId } from "../posts/socialPostFakes.fake.js";

const mediaId = "0192f0a0-0000-7000-8000-00000000d001";
const videoMedia = { id: "0192f0a0-0000-7000-8000-00000000d101", postId: "0192f0a0-0000-7000-8000-000000000001", mediaId, position: 0, type: "video", url: "https://cdn/v.mp4", posterUrl: null, hlsUrl: null, width: 720, height: 1280, durationSeconds: 9, blurhash: null, status: "ready" };

interface Scenario {
  readonly post?: Partial<PostRow>;
  readonly downloadsOff?: boolean;
  readonly authorPrivate?: boolean;
  readonly blocked?: boolean;
  readonly withClient?: boolean;
}

function scenario(options: Scenario = {}) {
  const post = buildPostRow({ kind: "clip", media: [videoMedia] as unknown as PostRow["media"], ...options.post });
  const base = buildFakeContext([post]);
  const requests: MediaDownloadVariantRequest[] = [];
  const overrides: Record<string, unknown> = {
    downloadSetting: { findMany: async () => (options.downloadsOff === true ? [{ accountId: authorId }] : []), findUnique: async () => null },
    block: { findMany: async () => (options.blocked === true ? [{ blockerId: authorId, blockedId: authorId }] : []), count: async () => (options.blocked === true ? 1 : 0) },
  };
  const client = new Proxy(base.database.client as unknown as Record<string, unknown>, { get: (target, key: string) => overrides[key] ?? target[key] });
  const context = {
    ...base,
    database: { client, transaction: async (work: (db: unknown) => Promise<unknown>) => work(client) },
    directory: {
      findPrivateAccountIds: async () => new Set(options.authorPrivate === true ? [authorId] : []),
      findUserSummaries: async () => new Map([[authorId, { id: authorId, name: "Ada", username: "ada", avatarUrl: null, verified: false, isCreator: false }]]),
    },
    ...(options.withClient === false ? {} : { mediaDownloads: { requestDownloadVariant: async (request: MediaDownloadVariantRequest) => (requests.push(request), { status: "processing" as const, progress: 0.02, retryAfterMs: 1500 }) } }),
  } as unknown as HandlerContext;
  return { context, requests, post, request: createRequestPostMediaDownloadHandler(context) };
}

const permissionBase = { viewerId, authorId, kind: "clip" as const, visibility: "public" as const, moderationVisibility: "visible", hasMedia: true, authorAllowsDownloads: true, authorIsPrivate: false };

describe("download permission", () => {
  it("lets owners always download their own media", () => {
    expect(decidePostDownloadPermission({ ...permissionBase, viewerId: authorId, authorAllowsDownloads: false, visibility: "subscribers", authorIsPrivate: true }).allowed).toBe(true);
  });

  it("refuses subscriber-only, private, story, hidden and opted-out content for others", () => {
    const codes = [
      { visibility: "subscribers" as const }, { authorIsPrivate: true }, { kind: "story" as const }, { moderationVisibility: "restricted" }, { authorAllowsDownloads: false }, { viewerId: undefined },
    ].map((change) => decidePostDownloadPermission({ ...permissionBase, ...change }));
    expect(codes.map((decision) => (decision.allowed ? "allowed" : decision.code))).toEqual(["SUBSCRIBERS_ONLY", "PRIVATE_ACCOUNT", "STORY_DOWNLOADS_OFF", "POST_NOT_AVAILABLE", "DOWNLOADS_DISABLED", "SIGN_IN_TO_DOWNLOAD"]);
  });
});

describe("post media download", () => {
  it("asks media for a variant watermarked with the owner's username", async () => {
    const { request, requests, post } = scenario();
    expect(await request({ viewerId, postId: post.id, mediaId })).toMatchObject({ status: "processing" });
    expect(requests).toEqual([{ mediaId, requesterId: viewerId, watermarkHandle: "ada", stripAudio: false }]);
  });

  it("refuses when the owner turned downloads off and never calls media", async () => {
    const { request, requests, post } = scenario({ downloadsOff: true });
    await expect(request({ viewerId, postId: post.id, mediaId })).rejects.toMatchObject({ status: 403, code: "DOWNLOADS_DISABLED" });
    expect(requests).toHaveLength(0);
  });

  it("hides the post from blocked viewers", async () => {
    const { request, post } = scenario({ blocked: true });
    await expect(request({ viewerId, postId: post.id, mediaId })).rejects.toMatchObject({ status: 404 });
  });

  it("refuses subscriber-only media and media from other posts", async () => {
    const subscribers = scenario({ post: { visibility: "subscribers" } });
    await expect(subscribers.request({ viewerId, postId: subscribers.post.id, mediaId })).rejects.toMatchObject({ code: "SUBSCRIBERS_ONLY" });
    const other = scenario();
    await expect(other.request({ viewerId, postId: other.post.id, mediaId: "0192f0a0-0000-7000-8000-00000000dfff" })).rejects.toMatchObject({ code: "MEDIA_NOT_IN_POST" });
  });

  it("reports downloads unavailable when the media service is not configured", async () => {
    const { request, post } = scenario({ withClient: false });
    await expect(request({ viewerId, postId: post.id, mediaId })).rejects.toMatchObject({ status: 503 });
  });

  it("tells clients whether to show the download button", async () => {
    const allowed = scenario();
    const [view] = await buildPostViews(allowed.context, viewerId, [allowed.post]);
    expect(view?.viewerCanDownload).toBe(true);
    const off = scenario({ downloadsOff: true });
    const [offView] = await buildPostViews(off.context, viewerId, [off.post]);
    expect(offView?.viewerCanDownload).toBe(false);
    const [guestView] = await buildPostViews(allowed.context, undefined, [allowed.post]);
    expect(guestView?.viewerCanDownload).toBe(false);
  });
});
