import { describe, expect, it } from "vitest";

import { createIdentityDirectory } from "../../src/integrations/identityDirectory.integration.js";

const profileId = "0192f0a0-0000-7000-8000-0000000000a1";

function createDirectory(checkmarks: readonly { profileId: string; color: string; status: string }[]) {
  let query: unknown;
  const directory = createIdentityDirectory({
    identityProfileCheckmark: {
      findMany: async (args: { where: { profileId: { in: string[] }; status: { in: string[] } } }) => {
        query = args;
        return checkmarks.filter((row) => args.where.profileId.in.includes(row.profileId) && args.where.status.in.includes(row.status));
      },
    },
  } as never, { warn: () => undefined, error: () => undefined, info: () => undefined } as never);
  return { directory, getQuery: () => query };
}

describe("profile checkmark read model", () => {
  it.each([
    ["blue", "verified"],
    ["gold", "grace"],
    ["black", "verified"],
  ] as const)("returns the active %s checkmark in %s status", async (color, status) => {
    const { directory } = createDirectory([{ profileId, color, status }]);

    await expect(directory.findProfileCheckmarkColors([profileId])).resolves.toEqual(new Map([[profileId, color]]));
  });

  it.each(["blue", "gold", "black"] as const)("does not return a revoked %s checkmark", async (color) => {
    const { directory } = createDirectory([{ profileId, color, status: "revoked" }]);

    await expect(directory.findProfileCheckmarkColors([profileId])).resolves.toEqual(new Map());
  });

  it("excludes revoked and missing checkmarks while retaining only active known colors", async () => {
    const otherProfile = "0192f0a0-0000-7000-8000-0000000000a2";
    const unknownColorProfile = "0192f0a0-0000-7000-8000-0000000000a3";
    const { directory, getQuery } = createDirectory([
      { profileId, color: "gold", status: "revoked" },
      { profileId: otherProfile, color: "blue", status: "verified" },
      { profileId: unknownColorProfile, color: "purple", status: "verified" },
    ]);

    await expect(directory.findProfileCheckmarkColors([profileId, otherProfile, unknownColorProfile, profileId])).resolves.toEqual(new Map([[otherProfile, "blue"]]));
    expect(getQuery()).toEqual({
      where: { profileId: { in: [profileId, otherProfile, unknownColorProfile] }, status: { in: ["verified", "grace"] } },
      select: { profileId: true, color: true },
    });
  });

  it("skips the read-model query when no profiles are requested", async () => {
    let queried = false;
    const directory = createIdentityDirectory({
      identityProfileCheckmark: { findMany: async () => { queried = true; return []; } },
    } as never, { warn: () => undefined, error: () => undefined, info: () => undefined } as never);

    await expect(directory.findProfileCheckmarkColors([])).resolves.toEqual(new Map());
    expect(queried).toBe(false);
  });
});
