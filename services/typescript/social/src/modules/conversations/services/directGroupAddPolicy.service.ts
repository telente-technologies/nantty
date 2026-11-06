import { conflict } from "../../../errors/social.error.js";
import type { Db } from "../../../types/database.type.js";

/** Users who opt out still remain inviteable; only unsolicited membership writes are blocked. */
export async function requireDirectGroupAddsAllowed(db: Db, accountIds: readonly string[]): Promise<void> {
  if (accountIds.length === 0) return;
  const settings = await db.chatSettings.findMany({
    where: { accountId: { in: [...new Set(accountIds)] }, preventDirectGroupAdds: true },
    select: { accountId: true },
  });
  if (settings.length > 0) {
    throw conflict("GROUP_INVITATION_REQUIRED", "At least one person only accepts group invitations. Send them an invitation instead.");
  }
}
