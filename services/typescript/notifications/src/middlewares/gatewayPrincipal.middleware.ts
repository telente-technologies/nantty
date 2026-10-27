import type { HttpRequestContext } from "@nantty/fastify-platform";

import { unauthorizedError } from "../errors/notifications.error.js";

export function requireAccountId(request: HttpRequestContext): string {
  const accountId = request.getHeader("x-nantty-account-id");
  if (accountId === undefined || accountId === "") throw unauthorizedError();
  return accountId;
}
