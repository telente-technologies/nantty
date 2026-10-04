import type { SafeFetcher, SafeFetchOptions } from "../../../integrations/safeHttpFetcher.integration.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { LinkPreviewImageStore } from "../../../interfaces/linkPreviewImageStore.interface.js";
import type { LinkUnfurler } from "../../../interfaces/linkUnfurler.interface.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";
import type { LinkPreviewView } from "../models/linkPreview.model.js";
import { linkPreviewCacheRepository, type LinkPreviewCacheRow } from "../repositories/linkPreviewCache.repository.js";
import { parseLinkPreviewMetadata, parseOembedMetadata } from "./linkPreviewParser.service.js";
import { defaultInternalHosts, findFirstExternalUrlInText, isInternalZudomartUrl, normalizeUrlForCache, readDisplayDomain } from "./linkPreviewUrl.service.js";

const readyLifetimeMs = 24 * 3_600_000;
const failedLifetimeMs = 3_600_000;
const pageFetch: SafeFetchOptions = { accept: "text/html,application/xhtml+xml", maximumBytes: 512 * 1024, truncateAtMaximum: true, timeoutMs: 5000, maximumRedirects: 3, isAllowedContentType: (type) => type.startsWith("text/html") || type.startsWith("application/xhtml+xml") };
const oembedFetch: SafeFetchOptions = { accept: "application/json", maximumBytes: 64 * 1024, truncateAtMaximum: false, timeoutMs: 3000, maximumRedirects: 2, isAllowedContentType: (type) => type.includes("json") };
const imageFetch: SafeFetchOptions = { accept: "image/avif,image/webp,image/png,image/jpeg", maximumBytes: 5 * 1024 * 1024, truncateAtMaximum: false, timeoutMs: 6000, maximumRedirects: 3, isAllowedContentType: (type) => /^image\/(jpeg|png|webp|avif)/.test(type) };

export interface LinkUnfurlerDependencies {
  readonly db: Db;
  readonly fetcher: SafeFetcher;
  readonly clock: Clock;
  readonly imageStore?: LinkPreviewImageStore | undefined;
  readonly internalHosts?: readonly string[];
}

function convertRowToView(row: LinkPreviewCacheRow): LinkPreviewView | null {
  if (row.status !== "ready" || row.title === null) return null;
  return { url: row.url, domain: readDisplayDomain(row.url), title: row.title, description: row.description, siteName: row.siteName, imageUrl: row.imageUrl, imageMediaId: row.imageMediaId };
}

export function createLinkUnfurler(dependencies: LinkUnfurlerDependencies): LinkUnfurler {
  const internalHosts = dependencies.internalHosts ?? defaultInternalHosts;
  const inFlight = new Map<string, Promise<LinkPreviewView | null>>();

  async function proxyImageThroughMedia(imageUrl: string | null): Promise<{ readonly mediaId: string; readonly url: string } | null> {
    if (imageUrl === null || dependencies.imageStore === undefined) return null;
    try {
      const image = await dependencies.fetcher(imageUrl, imageFetch);
      if (image.body.byteLength === 0) return null;
      return await dependencies.imageStore.storeImage(image.body, image.contentType.split(";")[0]?.trim() ?? "image/jpeg");
    } catch {
      return null;
    }
  }

  async function unfurlAndCache(rawUrl: string, normalizedUrl: string): Promise<LinkPreviewView | null> {
    const now = dependencies.clock.now();
    const saveFailure = async () => {
      await linkPreviewCacheRepository.save(dependencies.db, { normalizedUrl, url: rawUrl, status: "failed", fetchedAt: now, expiresAt: new Date(now.getTime() + failedLifetimeMs) });
      return null;
    };
    let page;
    try {
      page = await dependencies.fetcher(rawUrl, pageFetch);
    } catch {
      return saveFailure();
    }
    if (page.body.byteLength === 0) return saveFailure();
    let metadata = parseLinkPreviewMetadata(page.body.toString("utf8"), page.finalUrl);
    if ((metadata.title === null || metadata.imageUrl === null) && metadata.oembedUrl !== null) {
      try {
        const oembed = await dependencies.fetcher(metadata.oembedUrl, oembedFetch);
        const parsed = parseOembedMetadata(JSON.parse(oembed.body.toString("utf8")), page.finalUrl);
        metadata = { ...metadata, title: metadata.title ?? parsed.title, siteName: metadata.siteName ?? parsed.siteName, imageUrl: metadata.imageUrl ?? parsed.imageUrl };
      } catch {
        metadata = { ...metadata };
      }
    }
    if (metadata.title === null) return saveFailure();
    const image = await proxyImageThroughMedia(metadata.imageUrl);
    const row = await linkPreviewCacheRepository.save(dependencies.db, {
      normalizedUrl, url: rawUrl, status: "ready", title: metadata.title, description: metadata.description, siteName: metadata.siteName,
      imageUrl: image?.url ?? null, imageMediaId: image?.mediaId ?? null, fetchedAt: now, expiresAt: new Date(now.getTime() + readyLifetimeMs),
    });
    return convertRowToView(row);
  }

  async function resolveLinkPreview(rawUrl: string): Promise<LinkPreviewView | null> {
    if (isInternalZudomartUrl(rawUrl, internalHosts)) return null;
    const normalizedUrl = normalizeUrlForCache(rawUrl);
    if (normalizedUrl === null) return null;
    const cached = await linkPreviewCacheRepository.findFresh(dependencies.db, normalizedUrl, dependencies.clock.now());
    if (cached !== null) return convertRowToView(cached);
    const running = inFlight.get(normalizedUrl);
    if (running !== undefined) return running;
    const task = unfurlAndCache(normalizedUrl, normalizedUrl).finally(() => inFlight.delete(normalizedUrl));
    inFlight.set(normalizedUrl, task);
    return task;
  }

  return {
    resolveLinkPreview,
    async attachLinkPreviewToPost(postId, text) {
      const url = findFirstExternalUrlInText(text, internalHosts);
      if (url === null) return null;
      const preview = await resolveLinkPreview(url);
      if (preview !== null) await linkPreviewCacheRepository.attachToPost(dependencies.db, postId, preview as unknown as Prisma.InputJsonValue);
      return preview;
    },
  };
}
