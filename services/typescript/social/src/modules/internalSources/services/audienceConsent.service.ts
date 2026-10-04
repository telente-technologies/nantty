import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { AudienceMember, CursorPage } from "../models/internalSources.model.js";

export async function keepConsentingMembers(context: HandlerContext, candidates: readonly AudienceMember[], nextCursor: string | null): Promise<CursorPage<AudienceMember>> {
  const allowed = await context.directory.findAccountsAllowingPersonalizedAds(candidates.map((member) => member.accountId));
  return { data: candidates.filter((member) => allowed.has(member.accountId)), nextCursor };
}
