import type { DownloadTarget, Media, Post, PostMediaDownload } from "@/types";

const DEFAULT_POLL_INTERVAL_MS = 1500;
const MAXIMUM_WAIT_MS = 4 * 60_000;

export function findDownloadTargetForPost(post: Pick<Post, "id" | "media" | "sponsored" | "viewerCanDownload">): DownloadTarget | null {
  if (post.sponsored || post.viewerCanDownload === false) return null;
  const media = post.media.find((item: Media) => !!item.id && (item.status === undefined || item.status === "ready"));
  return media?.id ? { postId: post.id, mediaId: media.id, mediaType: media.type } : null;
}

export interface PollBrandedDownloadOptions {
  readonly requestDownload: () => Promise<PostMediaDownload>;
  readonly onProgress: (progress: number) => void;
  readonly signal?: AbortSignal;
  readonly waitMilliseconds?: (milliseconds: number) => Promise<void>;
  readonly now?: () => number;
}

const waitWithTimeout = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function pollUntilBrandedDownloadIsReady(options: PollBrandedDownloadOptions): Promise<PostMediaDownload & { readonly url: string }> {
  const wait = options.waitMilliseconds ?? waitWithTimeout;
  const now = options.now ?? Date.now;
  const startedAt = now();
  for (;;) {
    if (options.signal?.aborted) throw new DOMException("Download cancelled", "AbortError");
    const download = await options.requestDownload();
    if (download.status === "ready" && download.url) return { ...download, url: download.url };
    options.onProgress(Math.max(0, Math.min(0.99, download.progress)));
    if (now() - startedAt > MAXIMUM_WAIT_MS) throw new Error("This download is taking too long. Try again in a few minutes.");
    await wait(download.retryAfterMs ?? DEFAULT_POLL_INTERVAL_MS);
  }
}
