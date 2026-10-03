import type { HttpRequestContext } from "@zudojs/http";

import { unauthorizedError } from "../errors/notifications.error.js";

export function requireAccountId(request: HttpRequestContext): string {
  const accountId = request.getHeader("x-zudomart-account-id");
  if (accountId === undefined || accountId === "") throw unauthorizedError();
  return accountId;
}
