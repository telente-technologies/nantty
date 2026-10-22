import { describe, expect, it } from "vitest";

import { createRecordPostImpressionHandler } from "../../src/modules/posts/commands/recordPostImpression/recordPostImpression.handler.js";
import { createRecordProfileVisitFromPostHandler } from "../../src/modules/posts/commands/recordProfileVisitFromPost/recordProfileVisitFromPost.handler.js";
import { createSharePostHandler } from "../../src/modules/posts/commands/sharePost/sharePost.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

const missingPostId = "0192f0a0-0000-7000-8000-00000000dead";
const unusedContext = {} as HandlerContext;

describe("anonymous post counters are a no-op before any database access", () => {
  it("ignores an anonymous share of a missing post", async () => {
    await expect(createSharePostHandler(unusedContext)({ actorId: undefined, postId: missingPostId, channel: "link" })).resolves.toBeUndefined();
  });

  it("ignores an anonymous impression of a missing post", async () => {
    await expect(createRecordPostImpressionHandler(unusedContext)({ viewerId: undefined, postId: missingPostId })).resolves.toBeUndefined();
  });

  it("ignores an anonymous profile visit from a missing post", async () => {
    await expect(createRecordProfileVisitFromPostHandler(unusedContext)({ viewerId: undefined, postId: missingPostId })).resolves.toBeUndefined();
  });
});
