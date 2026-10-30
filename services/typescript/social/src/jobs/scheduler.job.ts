import type { Logger } from "@nantty/fastify-platform";

import type { HandlerContext } from "../types/handlerContext.type.js";
import { runChatMediaExpiry } from "./chatMediaExpiry.job.js";

export function startChatMediaExpiryJob(context: HandlerContext, logger: Logger, intervalMs: number): () => void {
  const timer = setInterval(() => {
    runChatMediaExpiry(context).catch((error: unknown) => logger.warn("chat media expiry failed", { error: error instanceof Error ? error.message : String(error) }));
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
