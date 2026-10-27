import { createHash, createHmac, randomBytes } from "node:crypto";

import type { HelpAnswerDraft, HelpAnswerWriter } from "../interfaces/helpAnswerWriter.interface.js";

export interface IntelligenceHelpWriterOptions {
  readonly baseUrl: string;
  readonly sharedSecret: string;
  readonly timeoutMs: number;
  readonly fetchImplementation?: typeof fetch;
}

export const helpAnswerDraftPath = "/v1/help/answer-drafts";

function signRequest(secret: string, body: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(18).toString("base64url");
  const canonical = ["v1", "POST", helpAnswerDraftPath, timestamp, nonce, createHash("sha256").update(body, "utf8").digest("hex")].join("\n");
  return { "content-type": "application/json", "x-nantty-timestamp": timestamp, "x-nantty-nonce": nonce, "x-nantty-signature": `v1=${createHmac("sha256", secret).update(canonical, "utf8").digest("hex")}` };
}

function readDraft(payload: unknown): HelpAnswerDraft | null {
  const value = payload as Record<string, unknown> | null;
  if (value === null || typeof value !== "object") return null;
  const text = (key: string) => (typeof value[key] === "string" ? (value[key] as string).trim() : "");
  const tags = Array.isArray(value["tags"]) ? (value["tags"] as unknown[]).filter((tag): tag is string => typeof tag === "string").slice(0, 8) : [];
  if (text("title") === "" || text("answerMarkdown") === "") return null;
  return { title: text("title"), summary: text("summary"), question: text("question") || text("title"), answerMarkdown: text("answerMarkdown"), tags, writer: `intelligence:${text("source") || "template"}` };
}

export function createIntelligenceHelpWriter(options: IntelligenceHelpWriterOptions): HelpAnswerWriter {
  const send = options.fetchImplementation ?? fetch;
  return {
    async writeHelpAnswer(input) {
      const body = JSON.stringify({ category: input.category, locale: input.locale, subject: input.subject, question: input.question, answer: input.answer });
      try {
        const response = await send(new URL(helpAnswerDraftPath, options.baseUrl), { method: "POST", body, headers: signRequest(options.sharedSecret, body), signal: AbortSignal.timeout(options.timeoutMs) });
        if (!response.ok) return null;
        return readDraft(await response.json());
      } catch {
        return null;
      }
    },
  };
}
