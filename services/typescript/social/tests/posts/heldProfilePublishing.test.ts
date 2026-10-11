import { describe, expect, it } from "vitest";

import { createIdentityDirectory } from "../../src/integrations/identityDirectory.integration.js";

type Where = Record<string, unknown>;

function directoryOver(rows: readonly (Where & { publishingHeld: boolean })[]) {
  const client = {
    identityProfile: {
      findFirst: async ({ where }: { where: Where }) =>
        rows.find((row) => row["id"] === where["id"] && row["accountId"] === where["accountId"] && (where["publishingHeld"] === undefined || row.publishingHeld === where["publishingHeld"])) ?? null,
    },
  };
  return createIdentityDirectory(client as never, { warn: () => undefined, error: () => undefined, info: () => undefined } as never);
}

describe("grandfathered profiles", () => {
  const held = { id: "page-held", accountId: "owner", kind: "business", displayName: "Extra page", handle: "extra", avatarUrl: null, publishingHeld: true };

  it("refuses new posts from a profile on hold", async () => {
    expect(await directoryOver([held]).findOwnedPostableProfile("owner", "page-held", "publish")).toBeNull();
  });

  it("still lets the owner manage existing posts from it", async () => {
    expect(await directoryOver([held]).findOwnedPostableProfile("owner", "page-held")).toMatchObject({ id: "page-held", kind: "business" });
  });
});
