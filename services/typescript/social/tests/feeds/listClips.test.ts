import { describe, expect, it } from "vitest";

import { createListClipsHandler } from "../../src/modules/feeds/queries/listClips/listClips.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

describe("list clips", () => {
  it("asks guests to sign in for the Following tab instead of showing For You clips", async () => {
    const listClips = createListClipsHandler({} as HandlerContext);
    await expect(listClips({ viewerId: undefined, tab: "following", cursor: undefined, limit: 10 })).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });
});
