import { createHash, createHmac, randomBytes } from "node:crypto";

import type { ModerationClient, ModerationRequest, ModerationResult } from "../interfaces/moderationClient.interface.js";

const maximumFramesSent = 6;
const classifyPath = "/v1/moderation/classify";

export function signIntelligenceRequest(sharedSecret: string, path: string, body: string, nowSeconds = Math.floor(Date.now() / 1000)): Record<string, string> {
  const timestamp = nowSeconds.toString();
  const nonce = randomBytes(18).toString("base64url");
  const canonical = ["v1", "POST", path, timestamp, nonce, createHash("sha256").update(body, "utf8").digest("hex")].join("\n");
  return { "x-zudo-timestamp": timestamp, "x-zudo-nonce": nonce, "x-zudo-signature": `v1=${createHmac("sha256", sharedSecret).update(canonical, "utf8").digest("hex")}` };
}

export function createHttpModerationClient(options: { readonly baseUrl: string; readonly token: string; readonly timeoutMs: number; readonly fetchFn?: typeof fetch }): ModerationClient {
  const fetchFn = options.fetchFn ?? fetch;
  return {
    async classify(request: ModerationRequest): Promise<ModerationResult> {
      const requestBody = JSON.stringify({
        contentId: request.mediaId,
        contentType: "post",
        text: request.text !== undefined && request.text !== "" ? request.text : `[${request.kind} upload for ${request.purpose}]`,
        authorId: request.ownerId,
        media: { kind: request.kind, frames: request.frames.slice(0, maximumFramesSent).map((frame) => ({ mimeType: "image/jpeg", dataBase64: Buffer.from(frame).toString("base64") })) },
      });
      const response = await fetchFn(`${options.baseUrl.replace(/\/$/, "")}${classifyPath}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(options.token === "" ? {} : signIntelligenceRequest(options.token, classifyPath, requestBody)) },
        body: requestBody,
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!response.ok) throw new Error(`moderation classify answered ${response.status}`);
      const body = (await response.json()) as { score?: unknown; topCategory?: unknown };
      if (typeof body.score !== "number" || Number.isNaN(body.score)) throw new Error("moderation classify returned no score");
      return { score: Math.min(1, Math.max(0, body.score)), topCategory: typeof body.topCategory === "string" ? body.topCategory : null };
    },
  };
}
