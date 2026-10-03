import type { HttpRouterContext } from "@zudojs/http";

import { accountIdHeaderName } from "../constants/social.constant.js";
import { unauthorized } from "../errors/social.error.js";
import type { Principal } from "../types/principal.type.js";

const accountIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function findPrincipal(context: HttpRouterContext): Principal | undefined {
  const accountId = context.request.getHeader(accountIdHeaderName)?.trim();
  return accountId !== undefined && accountIdPattern.test(accountId) ? { accountId: accountId.toLowerCase() } : undefined;
}

export function requirePrincipal(context: HttpRouterContext): Principal {
  const principal = findPrincipal(context);
  if (principal === undefined) throw unauthorized();
  return principal;
}
