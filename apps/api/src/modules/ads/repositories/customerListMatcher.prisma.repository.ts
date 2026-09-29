import { createHash } from "node:crypto";

import { prisma } from "../../../integrations/database.integration.js";
import type { HashedIdentifierType } from "../models/adAudiences.model.js";
import type { CustomerListMatcher } from "../models/adsToolsDependencies.model.js";

const USER_SCAN_PAGE_SIZE = 1_000;

export function hashNormalizedIdentifier(identifierType: HashedIdentifierType, value: string): string {
  const normalized = identifierType === "email" ? value.trim().toLowerCase() : value.replace(/\D/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export class PrismaUserCustomerListMatcher implements CustomerListMatcher {
  public async matchHashedIdentifiers(identifierType: HashedIdentifierType, hashes: readonly string[]): Promise<readonly { readonly hash: string; readonly userId: string }[]> {
    const wanted = new Set(hashes);
    const matches: { hash: string; userId: string }[] = [];
    let cursor: string | undefined;
    for (;;) {
      const users = await prisma().user.findMany({
        select: { id: true, email: true, phone: true },
        where: identifierType === "email" ? { email: { not: null } } : { phone: { not: null } },
        orderBy: { id: "asc" },
        take: USER_SCAN_PAGE_SIZE,
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      });
      for (const user of users) {
        const value = identifierType === "email" ? user.email : user.phone;
        if (value === null) continue;
        const hash = hashNormalizedIdentifier(identifierType, value);
        if (wanted.has(hash)) matches.push({ hash, userId: user.id });
      }
      if (users.length < USER_SCAN_PAGE_SIZE) return matches;
      cursor = users.at(-1)?.id;
    }
  }
}
