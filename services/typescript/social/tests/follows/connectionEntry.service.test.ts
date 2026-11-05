import { describe, expect, it } from "vitest";

import { buildConnectionEntries } from "../../src/modules/follows/services/connectionEntry.service.js";
import { createMemoryStore } from "../comments/memoryDb.fake.js";

const viewerId = "0192f0a0-0000-7000-8000-00000000a001";
const candidateId = "0192f0a0-0000-7000-8000-00000000b001";
const privateCandidateId = "0192f0a0-0000-7000-8000-00000000c001";
const sharedOneId = "0192f0a0-0000-7000-8000-00000000d001";
const sharedTwoId = "0192f0a0-0000-7000-8000-00000000e001";
const notSharedId = "0192f0a0-0000-7000-8000-00000000f001";

function follow(followerId: string, followeeId: string, state: "accepted" | "requested" | "rejected" = "accepted") {
  return { id: `${followerId}-${followeeId}`, followerId, followeeId, state };
}

describe("buildConnectionEntries relationship metadata", () => {
  it("returns accepted reverse-follow state and the exact accepted shared-following count", async () => {
    const store = createMemoryStore();
    store.follows.push(
      follow(viewerId, sharedOneId),
      follow(viewerId, sharedTwoId),
      follow(candidateId, sharedOneId),
      follow(candidateId, sharedTwoId),
      follow(candidateId, notSharedId),
      follow(candidateId, viewerId),
      follow(candidateId, "0192f0a0-0000-7000-8000-000000001001", "requested"),
      follow("0192f0a0-0000-7000-8000-000000001002", viewerId, "requested"),
    );

    await expect(buildConnectionEntries(store.context, viewerId, [candidateId])).resolves.toMatchObject([
      { id: candidateId, isFollowing: false, followsYou: true, mutualConnections: 2 },
    ]);
  });

  it("does not expose relationship metadata to guests", async () => {
    const store = createMemoryStore();
    store.follows.push(follow(candidateId, viewerId), follow(candidateId, sharedOneId));

    await expect(buildConnectionEntries(store.context, undefined, [candidateId])).resolves.toMatchObject([
      { id: candidateId, followsYou: false, mutualConnections: 0 },
    ]);
  });

  it("suppresses reverse-follow and mutual metadata for either direction of a block", async () => {
    for (const [blockerId, blockedId] of [[viewerId, candidateId], [candidateId, viewerId]]) {
      const store = createMemoryStore();
      store.follows.push(follow(viewerId, candidateId), follow(candidateId, viewerId), follow(viewerId, sharedOneId), follow(candidateId, sharedOneId));
      store.blocks.push({ blockerId, blockedId });

      await expect(buildConnectionEntries(store.context, viewerId, [candidateId])).resolves.toMatchObject([
        { id: candidateId, followsYou: false, mutualConnections: 0 },
      ]);
    }
  });

  it("suppresses metadata for a private candidate unless the viewer is an accepted follower", async () => {
    const store = createMemoryStore();
    store.privateAccountIds.add(privateCandidateId);
    store.follows.push(follow(viewerId, sharedOneId), follow(privateCandidateId, sharedOneId), follow(privateCandidateId, viewerId));

    await expect(buildConnectionEntries(store.context, viewerId, [privateCandidateId])).resolves.toMatchObject([
      { id: privateCandidateId, followsYou: false, mutualConnections: 0 },
    ]);

    store.follows.push(follow(viewerId, privateCandidateId));
    await expect(buildConnectionEntries(store.context, viewerId, [privateCandidateId])).resolves.toMatchObject([
      { id: privateCandidateId, followsYou: true, mutualConnections: 1 },
    ]);
  });

  it("keeps relationship metadata aligned with the requested account order", async () => {
    const store = createMemoryStore();
    store.follows.push(follow(viewerId, sharedOneId), follow(candidateId, sharedOneId));

    const entries = await buildConnectionEntries(store.context, viewerId, [privateCandidateId, candidateId]);
    expect(entries.map(({ id, mutualConnections }) => [id, mutualConnections])).toEqual([[privateCandidateId, 0], [candidateId, 1]]);
  });
});
