import type { PostMediaDownload } from "@/types";

import { DownloadCancelledError, mapTransferProgressToOverall, pollUntilBrandedDownloadIsReady } from "../brandedDownloadPolling.util";

describe("branded download polling", () => {
  it("reports preparing progress until the server hands back a signed link", async () => {
    const responses: PostMediaDownload[] = [
      { status: "processing", progress: 0.02, retryAfterMs: 10 },
      { status: "processing", progress: 0.6, retryAfterMs: 10 },
      { status: "ready", progress: 1, url: "https://signed.example/clip.mp4", fileName: "zudomart-ada.mp4" },
    ];
    const progress: number[] = [];
    const waits: number[] = [];
    const ready = await pollUntilBrandedDownloadIsReady({
      requestDownload: async () => responses.shift() as PostMediaDownload,
      onPreparingProgress: (value) => progress.push(value),
      waitMilliseconds: async (milliseconds) => { waits.push(milliseconds); },
    });
    expect(ready.url).toBe("https://signed.example/clip.mp4");
    expect(progress).toEqual([0.01, 0.3]);
    expect(waits).toEqual([10, 10]);
  });

  it("stops when the person cancels", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(pollUntilBrandedDownloadIsReady({ requestDownload: async () => ({ status: "processing", progress: 0 }), onPreparingProgress: () => undefined, signal: controller.signal })).rejects.toBeInstanceOf(DownloadCancelledError);
  });

  it("maps file transfer onto the second half of the bar without reaching 100% before saving", () => {
    expect(mapTransferProgressToOverall(0, 100)).toBe(0.5);
    expect(mapTransferProgressToOverall(100, 100)).toBeCloseTo(0.975);
    expect(mapTransferProgressToOverall(5, 0)).toBe(0.5);
  });
});
