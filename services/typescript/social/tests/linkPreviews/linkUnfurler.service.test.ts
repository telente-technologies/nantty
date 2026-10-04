import { describe, expect, it } from "vitest";

import type { SafeFetcher } from "../../src/integrations/safeHttpFetcher.integration.js";
import { parseLinkPreviewMetadata } from "../../src/modules/linkPreviews/services/linkPreviewParser.service.js";
import { findFirstExternalUrlInText, normalizeUrlForCache } from "../../src/modules/linkPreviews/services/linkPreviewUrl.service.js";
import { createLinkUnfurler } from "../../src/modules/linkPreviews/services/linkUnfurler.service.js";
import type { Db } from "../../src/types/database.type.js";

function createFakeDatabase() {
  const cache = new Map<string, Record<string, unknown>>();
  const attached = new Map<string, unknown>();
  const db = {
    linkPreviewCache: {
      findFirst: async ({ where }: { where: { normalizedUrl: string; expiresAt: { gt: Date } } }) => {
        const row = cache.get(where.normalizedUrl);
        return row !== undefined && (row["expiresAt"] as Date) > where.expiresAt.gt ? row : null;
      },
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        const row = { title: null, description: null, siteName: null, imageUrl: null, imageMediaId: null, ...create };
        cache.set(create["normalizedUrl"] as string, row);
        return row;
      },
    },
    post: { updateMany: async ({ where, data }: { where: { id: string }; data: { linkPreview: unknown } }) => { attached.set(where.id, data.linkPreview); return { count: 1 }; } },
  };
  return { db: db as unknown as Db, cache, attached };
}

const articleHtml = `<html><head><title>Fallback</title>
<meta property="og:title" content="Lagos tech week &amp; more">
<meta name="description" content="Short summary">
<meta property="og:site_name" content="TechCabal">
<meta property="og:image" content="/images/cover.jpg"></head><body></body></html>`;

describe("link preview parsing", () => {
  it("reads Open Graph, falls back to meta description and resolves relative images", () => {
    const parsed = parseLinkPreviewMetadata(articleHtml, new URL("https://techcabal.com/2026/10/article"));
    expect(parsed).toMatchObject({ title: "Lagos tech week & more", description: "Short summary", siteName: "TechCabal", imageUrl: "https://techcabal.com/images/cover.jpg" });
  });

  it("drops javascript: image URLs and reads twitter cards", () => {
    const parsed = parseLinkPreviewMetadata(`<meta name="twitter:title" content="T"><meta name="twitter:image" content="javascript:alert(1)">`, new URL("https://x.example/"));
    expect(parsed.title).toBe("T");
    expect(parsed.imageUrl).toBeNull();
  });

  it("strips tracking parameters when normalising and skips internal links", () => {
    expect(normalizeUrlForCache("HTTPS://Example.com:443/a?utm_source=x&b=2&a=1#top")).toBe("https://example.com/a?a=1&b=2");
    expect(findFirstExternalUrlInText("see https://app.zudomart.com/p/shoe-1 and https://news.example/a.")).toBe("https://news.example/a");
    expect(findFirstExternalUrlInText("only https://zudomart.com/ada")).toBeNull();
  });
});

describe("createLinkUnfurler", () => {
  it("unfurls once, proxies the image through media and serves later calls from the cache", async () => {
    const { db, attached } = createFakeDatabase();
    const fetched: string[] = [];
    const fetcher: SafeFetcher = async (url) => {
      fetched.push(url);
      return url.endsWith(".jpg")
        ? { finalUrl: new URL(url), status: 200, contentType: "image/jpeg", body: Buffer.from([0xff, 0xd8, 0xff]) }
        : { finalUrl: new URL(url), status: 200, contentType: "text/html", body: Buffer.from(articleHtml) };
    };
    const stored: string[] = [];
    const unfurler = createLinkUnfurler({ db, fetcher, clock: { now: () => new Date("2026-10-04T10:00:00Z") }, imageStore: { storeImage: async (_bytes, type) => { stored.push(type); return { mediaId: "0192f000-0000-7000-8000-000000000001", url: "https://media.zudomart.com/m/1/display.jpg" }; } } });
    const preview = await unfurler.attachLinkPreviewToPost("post-1", "Read this https://techcabal.com/2026/10/article?utm_campaign=x");
    expect(preview).toMatchObject({ title: "Lagos tech week & more", domain: "techcabal.com", imageUrl: "https://media.zudomart.com/m/1/display.jpg", imageMediaId: "0192f000-0000-7000-8000-000000000001" });
    expect(stored).toEqual(["image/jpeg"]);
    expect(attached.get("post-1")).toEqual(preview);
    await unfurler.resolveLinkPreview("https://techcabal.com/2026/10/article");
    expect(fetched.filter((url) => !url.endsWith(".jpg"))).toHaveLength(1);
  });

  it("never hotlinks: without a media store the image is dropped", async () => {
    const { db } = createFakeDatabase();
    const fetcher: SafeFetcher = async (url) => ({ finalUrl: new URL(url), status: 200, contentType: "text/html", body: Buffer.from(articleHtml) });
    const preview = await createLinkUnfurler({ db, fetcher, clock: { now: () => new Date() } }).resolveLinkPreview("https://techcabal.com/a");
    expect(preview?.imageUrl).toBeNull();
  });

  it("caches failures and returns null for blocked or empty pages", async () => {
    const { db, cache } = createFakeDatabase();
    const fetcher: SafeFetcher = async () => { throw new Error("blocked"); };
    const unfurler = createLinkUnfurler({ db, fetcher, clock: { now: () => new Date() } });
    expect(await unfurler.resolveLinkPreview("http://169.254.169.254.nip.example/")).toBeNull();
    expect([...cache.values()][0]?.["status"]).toBe("failed");
  });

  it("does not unfurl Zudomart links", async () => {
    const { db } = createFakeDatabase();
    let calls = 0;
    const fetcher: SafeFetcher = async () => { calls += 1; throw new Error("unexpected"); };
    expect(await createLinkUnfurler({ db, fetcher, clock: { now: () => new Date() } }).resolveLinkPreview("https://app.zudomart.com/ada")).toBeNull();
    expect(calls).toBe(0);
  });
});
