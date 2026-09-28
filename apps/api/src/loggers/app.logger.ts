import { createLogger } from "@zudojs/logger";

import { REDACTED_LOG_FIELDS } from "./redact.logger.js";

export function createAppLogger(name: string) {
  return createLogger({ name, redact: { keys: [...REDACTED_LOG_FIELDS] } });
}
