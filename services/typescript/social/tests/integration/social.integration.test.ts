import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createSocialDatabase } from "../../src/databases/prisma.database.js";
import { deterministicFeedRanker } from "../../src/integrations/deterministicFeedRanker.integration.js";
import { noPremiumEntitlements } from "../../src/integrations/premiumEntitlements.integration.js";
import { systemClock } from "../../src/interfaces/clock.interface.js";
import type { IdentityDirectory, UserSummary } from "../../src/interfaces/identityDirectory.interface.js";
import { createFollowUserHandler } from "../../src/modules/follows/commands/followUser/followUser.handler.js";
import { createRespondToFollowRequestHandler } from "../../src/modules/follows/commands/respondToFollowRequest/respondToFollowRequest.handler.js";
import { createListFollowRequestsHandler } from "../../src/modules/follows/queries/listFollowRequests/listFollowRequests.handler.js";

const enabled = process.env["RUN_INTEGRATION"] === "1" && process.env["DATABASE_URL"] !== undefined;

function directoryWithPrivateAccount(users: readonly UserSummary[], privateId: string): IdentityDirectory {
  const map = new Map(users.map((user) => [user.id, user]));
  return {
    findUserSummaries: async (ids) => new Map(ids.flatMap((id) => (map.has(id) ? [[id, map.get(id) as UserSummary] as const] : []))),
    findAccountIdsByUsernames: async () => new Map(),
    searchUserSummaries: async () => [],
    findPrivateAccountIds: async (ids) => new Set(ids.filter((id) => id === privateId)),
    findMentionPrivacy: async () => new Map(),
    findMentionTargetStatuses: async () => new Map(),
    hasPersonalizationConsent: async () => false,
    findAccountCreatedAt: async () => undefined,
  };
}

describe.skipIf(!enabled)("social integration (needs Postgres with the social schema migrated)", () => {
  it("turns a follow of a private profile into a request that can be accepted", async () => {
    const database = createSocialDatabase(process.env["DATABASE_URL"] as string);
    const [follower, owner] = [randomUUID(), randomUUID()];
    const summary = (id: string): UserSummary => ({ id, name: id, username: id.slice(0, 8), avatarUrl: null, verified: false, isCreator: false });
    const context = { database, directory: directoryWithPrivateAccount([summary(follower), summary(owner)], owner), clock: systemClock, premium: noPremiumEntitlements, ranker: deterministicFeedRanker };
    expect(await createFollowUserHandler(context)({ followerId: follower, targetId: owner })).toEqual({ state: "requested" });
    const requests = await createListFollowRequestsHandler(context)({ followeeId: owner, cursor: undefined, limit: 10 });
    expect(requests.data).toHaveLength(1);
    await createRespondToFollowRequestHandler(context)({ followeeId: owner, requestId: requests.data[0]?.id as string, decision: "accept" });
    expect(await createFollowUserHandler(context)({ followerId: follower, targetId: owner })).toEqual({ state: "accepted" });
    const pending = await database.client.outboxEvent.count({ where: { subject: requests.data[0]?.id as string } });
    expect(pending).toBeGreaterThanOrEqual(2);
    await database.disconnect();
  });
});
