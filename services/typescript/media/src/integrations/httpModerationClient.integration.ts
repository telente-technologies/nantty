import type { ModerationClient, ModerationRequest, ModerationResult } from "../interfaces/moderationClient.interface.js";

const maximumFramesSent = 6;

export function createHttpModerationClient(options: { readonly baseUrl: string; readonly token: string; readonly timeoutMs: number; readonly fetchFn?: typeof fetch }): ModerationClient {
  const fetchFn = options.fetchFn ?? fetch;
  return {
    async classify(request: ModerationRequest): Promise<ModerationResult> {
      const response = await fetchFn(`${options.baseUrl.replace(/\/$/, "")}/v1/moderation/classify`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(options.token === "" ? {} : { "x-internal-token": options.token }) },
        body: JSON.stringify({
          contentId: request.mediaId,
          contentType: "post",
          text: request.text !== undefined && request.text !== "" ? request.text : `[${request.kind} upload for ${request.purpose}]`,
          authorId: request.ownerId,
          media: { kind: request.kind, frames: request.frames.slice(0, maximumFramesSent).map((frame) => ({ mimeType: "image/jpeg", dataBase64: Buffer.from(frame).toString("base64") })) },
        }),
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!response.ok) throw new Error(`moderation classify answered ${response.status}`);
      const body = (await response.json()) as { score?: unknown; topCategory?: unknown };
      if (typeof body.score !== "number" || Number.isNaN(body.score)) throw new Error("moderation classify returned no score");
      return { score: Math.min(1, Math.max(0, body.score)), topCategory: typeof body.topCategory === "string" ? body.topCategory : null };
    },
  };
}
