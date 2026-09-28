import { DEFAULT_LOGGER_SECRET_FIELDS } from "@zudojs/logger";

export const REDACTED_LOG_FIELDS: readonly string[] = [
  ...DEFAULT_LOGGER_SECRET_FIELDS,
  "code",
  "account number",
  "bank account",
  "bvn",
  "nin",
  "phone",
  "birthday",
  "signature",
  "hash",
  "idempotency key",
];
