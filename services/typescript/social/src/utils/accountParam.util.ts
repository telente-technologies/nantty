import { schema } from "@nantty/fastify-platform";

import { unauthorized } from "../errors/social.error.js";

const accountIdOrMe = /^(me|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

export const accountIdOrMeParam = schema.string().regex(accountIdOrMe);

export function resolveAccountParam(userId: string, principalAccountId: string | undefined): string {
  if (userId !== "me") return userId;
  if (principalAccountId === undefined) throw unauthorized();
  return principalAccountId;
}
