import type { PostMediaDownload } from "@/types";

export const PREPARING_SHARE_OF_PROGRESS = 0.5;
const DEFAULT_POLL_INTERVAL_MS = 1500;
const MAXIMUM_WAIT_MS = 4 * 60_000;

export class DownloadCancelledError extends Error {
  public constructor() {
    super("Download cancelled");
    this.name = "DownloadCancelledError";
  }
}

export interface PollForReadyDownloadOptions {
  readonly requestDownload: () => Promise<PostMediaDownload>;
  readonly onPreparingProgress: (overallProgress: number) => void;
  readonly signal?: AbortSignal;
  readonly waitMilliseconds?: (milliseconds: number) => Promise<void>;
  readonly now?: () => number;
}

const waitWithTimeout = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export const mapPreparingProgressToOverall = (serverProgress: number) => Math.max(0, Math.min(1, serverProgress)) * PREPARING_SHARE_OF_PROGRESS;
export const mapTransferProgressToOverall = (bytesWritten: number, totalBytes: number) =>
  PREPARING_SHARE_OF_PROGRESS + (totalBytes > 0 ? Math.min(1, bytesWritten / totalBytes) : 0) * (1 - PREPARING_SHARE_OF_PROGRESS) * 0.95;

export async function pollUntilBrandedDownloadIsReady(options: PollForReadyDownloadOptions): Promise<PostMediaDownload & { readonly url: string }> {
  const wait = options.waitMilliseconds ?? waitWithTimeout;
  const now = options.now ?? Date.now;
  const startedAt = now();
  for (;;) {
    if (options.signal?.aborted) throw new DownloadCancelledError();
    const download = await options.requestDownload();
    if (download.status === "ready" && download.url) return { ...download, url: download.url };
    options.onPreparingProgress(mapPreparingProgressToOverall(download.progress));
    if (now() - startedAt > MAXIMUM_WAIT_MS) throw new Error("This download is taking too long. Try again in a few minutes.");
    await wait(download.retryAfterMs ?? DEFAULT_POLL_INTERVAL_MS);
  }
}
